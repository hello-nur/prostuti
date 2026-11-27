package com.prostuti.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Prostuti: hosts the offline web app (assets) in a WebView and gives it a
 * small native bridge for calling the Gemini API without browser CORS limits.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/index.html";
    private static final String GEMINI_API = "https://generativelanguage.googleapis.com/";
    private static final String GROQ_API = "https://api.groq.com/";

    private WebView web;
    private FrameLayout root;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        boolean night = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int pageColor = night ? Color.parseColor("#0D1512") : Color.parseColor("#F6F4EE");

        root = new FrameLayout(this);
        root.setBackgroundColor(pageColor);
        web = new WebView(this);
        web.setBackgroundColor(pageColor);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        setupEdgeToEdge(night);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) return false;
                openExternal(url);
                return true;
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    /** Draw behind the system bars and pad the content so nothing is hidden (works on Android 7–15+). */
    @SuppressWarnings("deprecation")
    private void setupEdgeToEdge(boolean night) {
        Window w = getWindow();
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(night ? 0 : light, light);
            }
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (!night && Build.VERSION.SDK_INT >= 23) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (!night && Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            w.getDecorView().setSystemUiVisibility(flags);
        }
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                l = bars.left; t = bars.top; r = bars.right; b = Math.max(bars.bottom, ime.bottom);
            } else {
                l = insets.getSystemWindowInsetLeft();
                t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight();
                b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
    }

    private void openExternal(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.appBack && window.appBack()) ? 'y' : 'n'", value -> {
            if (value == null || !value.contains("y")) finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Methods callable from JavaScript as window.AndroidBridge.* */
    private class Bridge {

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> openExternal(url));
        }

        @JavascriptInterface
        public void request(final String id, final String method, final String url,
                            final String key, final String body) {
            pool.execute(() -> {
                int status = 0;
                String text;
                HttpURLConnection c = null;
                try {
                    boolean groq = url != null && url.startsWith(GROQ_API);
                    if (url == null || !(groq || url.startsWith(GEMINI_API))) throw new SecurityException("blocked url");
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod("POST".equals(method) ? "POST" : "GET");
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(80000);
                    c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    if (key != null && !key.isEmpty()) {
                        if (groq) c.setRequestProperty("Authorization", "Bearer " + key);
                        else c.setRequestProperty("x-goog-api-key", key);
                    }
                    if ("POST".equals(method)) {
                        byte[] data = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
                        c.setDoOutput(true);
                        c.setFixedLengthStreamingMode(data.length);
                        try (OutputStream os = c.getOutputStream()) {
                            os.write(data);
                        }
                    }
                    status = c.getResponseCode();
                    InputStream is = status >= 400 ? c.getErrorStream() : c.getInputStream();
                    text = is == null ? "" : readAll(is);
                } catch (Exception e) {
                    status = 0;
                    text = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                final String b64 = Base64.encodeToString(text.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
                final String js = "window.__bridgeCb(" + JSONObject.quote(id) + "," + status + ",'" + b64 + "')";
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript(js, null);
                });
            });
        }
    }

    private static String readAll(InputStream is) throws java.io.IOException {
        try (InputStream in = is; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
