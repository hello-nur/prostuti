/* Prostuti — syllabus catalog (SSC / HSC / Admission) */
window.CATALOG = (function () {
  const S = {};
  function sub(id, en, bn, icon, ch) { S[id] = { id, en, bn, icon, ch }; }

  /* ---------- Shared language subjects ---------- */
  sub("ban", "Bangla", "বাংলা", "অ", [
    "ধ্বনি ও বর্ণ", "সন্ধি", "সমাস", "কারক ও বিভক্তি", "প্রকৃতি ও প্রত্যয়", "পদ প্রকরণ",
    "বাগধারা", "বানান ও শুদ্ধিকরণ", "বাংলা সাহিত্য (লেখক ও রচনা)", "এক কথায় প্রকাশ", "সমার্থক ও বিপরীত শব্দ"
  ]);
  sub("eng", "English", "ইংরেজি", "Aa", [
    "Tense & Right Form of Verbs", "Voice", "Narration", "Articles", "Prepositions", "Transformation of Sentences",
    "Synonyms & Antonyms", "Tag Questions", "Spelling & Vocabulary", "Conditionals & Modals", "Reading Comprehension"
  ]);

  /* ---------- SSC ---------- */
  sub("ssc_phy", "Physics", "পদার্থবিজ্ঞান", "⚛", [
    "Physical Quantities & Measurement", "Motion", "Force", "Work, Power & Energy", "State of Matter & Pressure",
    "Effect of Heat on Matter", "Waves & Sound", "Reflection of Light", "Refraction of Light", "Static Electricity",
    "Current Electricity", "Magnetic Effects of Current", "Modern Physics & Electronics", "Physics to Save Life"
  ]);
  sub("ssc_che", "Chemistry", "রসায়ন", "⚗", [
    "Concept of Chemistry", "States of Matter", "Structure of Matter", "Periodic Table", "Chemical Bonds",
    "Mole Concept & Chemical Calculations", "Chemical Reactions", "Chemistry & Energy", "Acid-Base Balance",
    "Mineral Resources: Metals & Non-metals", "Mineral Resources: Fossils", "Chemistry in Our Lives"
  ]);
  sub("ssc_bio", "Biology", "জীববিজ্ঞান", "🌿", [
    "Lessons on Life", "Cell & Tissues", "Cell Division", "Bioenergetics", "Food, Nutrition & Digestion",
    "Transport in Organisms", "Exchange of Gases", "Excretory System", "Firmness & Locomotion", "Coordination",
    "Reproduction in Organisms", "Heredity & Evolution", "Life Style of Organisms", "Biotechnology"
  ]);
  sub("ssc_hmath", "Higher Mathematics", "উচ্চতর গণিত", "∑", [
    "Set & Function", "Algebraic Expressions", "Geometry", "Geometric Constructions", "Equations", "Inequality",
    "Infinite Series", "Trigonometry", "Exponential & Logarithmic Functions", "Binomial Expansion",
    "Coordinate Geometry", "Planar Vector", "Solid Geometry", "Probability"
  ]);
  sub("ssc_math", "General Mathematics", "সাধারণ গণিত", "÷", [
    "Real Numbers", "Sets & Functions", "Algebraic Expressions", "Exponents & Logarithms", "Equations in One Variable",
    "Lines, Angles & Triangles", "Practical Geometry", "Circle", "Trigonometric Ratios", "Distance & Height",
    "Ratio, Similarity & Symmetry", "Simultaneous Equations", "Finite Series", "Mensuration", "Statistics"
  ]);
  sub("ssc_ict", "ICT", "তথ্য ও যোগাযোগ প্রযুক্তি", "⌨", [
    "ICT & Our Bangladesh", "Communication & Networking", "Computer & Computer Users", "Safe Use of Computer & Internet",
    "Word Processing & Spreadsheet", "Multimedia, Graphics & Database"
  ]);
  sub("ssc_bgs", "Bangladesh & Global Studies", "বাংলাদেশ ও বিশ্বপরিচয়", "🌏", [
    "Background of Independence", "Liberation War", "Bangladesh after Independence", "Geography of Bangladesh",
    "Citizenship & Constitution", "State & Government", "Economy of Bangladesh", "Population & Society",
    "Bangladesh & International Organizations"
  ]);
  sub("ssc_acc", "Accounting", "হিসাববিজ্ঞান", "₹", [
    "Introduction to Accounting", "Transactions", "Double Entry System", "Accounts", "Journal", "Ledger",
    "Cash Book", "Trial Balance", "Financial Statements", "Depreciation"
  ]);
  sub("ssc_fin", "Finance & Banking", "ফিন্যান্স ও ব্যাংকিং", "৳", [
    "Introduction to Finance", "Sources of Finance", "Time Value of Money", "Bank & Banking", "Central Bank",
    "Commercial Banks", "Insurance"
  ]);
  sub("ssc_bus", "Business Entrepreneurship", "ব্যবসায় উদ্যোগ", "💼", [
    "Introduction to Business", "Entrepreneurship", "Sole Proprietorship", "Partnership", "Joint Stock Company",
    "Cooperatives", "Business Ethics"
  ]);
  sub("ssc_his", "History of Bangladesh & World Civilization", "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা", "🏛", [
    "Ancient Civilizations", "Ancient Bengal", "Medieval Bengal", "British Rule", "Pakistan Era", "Liberation War"
  ]);
  sub("ssc_geo", "Geography & Environment", "ভূগোল ও পরিবেশ", "🗺", [
    "The Universe & Earth", "Earth's Motion", "Atmosphere", "Hydrosphere", "Population", "Geography of Bangladesh"
  ]);
  sub("ssc_civ", "Civics & Citizenship", "পৌরনীতি ও নাগরিকতা", "⚖", [
    "Civics & Citizenship", "State & Government", "Rule of Law & Rights", "Constitution", "Local Government"
  ]);
  sub("ssc_eco", "Economics", "অর্থনীতি", "📈", [
    "Introduction to Economics", "Demand & Supply", "Production", "Market", "National Income", "Money & Banking"
  ]);

  /* ---------- HSC ---------- */
  sub("hsc_phy", "Physics (1st & 2nd)", "পদার্থবিজ্ঞান (১ম ও ২য়)", "⚛", [
    "1st: Physical World & Measurement", "1st: Vector", "1st: Dynamics", "1st: Newtonian Mechanics",
    "1st: Work, Energy & Power", "1st: Gravitation & Gravity", "1st: Structural Properties of Matter",
    "1st: Periodic Motion", "1st: Waves", "1st: Ideal Gas & Kinetic Theory",
    "2nd: Thermodynamics", "2nd: Static Electricity", "2nd: Current Electricity", "2nd: Magnetic Effects & Magnetism",
    "2nd: EM Induction & AC", "2nd: Geometrical Optics", "2nd: Physical Optics", "2nd: Introduction to Modern Physics",
    "2nd: Atomic Model & Nuclear Physics", "2nd: Semiconductor & Electronics", "2nd: Astronomy"
  ]);
  sub("hsc_che", "Chemistry (1st & 2nd)", "রসায়ন (১ম ও ২য়)", "⚗", [
    "1st: Laboratory Safe Use", "1st: Qualitative Chemistry", "1st: Periodic Properties & Bonding",
    "1st: Chemical Changes", "1st: Working Chemistry",
    "2nd: Environmental Chemistry", "2nd: Organic Chemistry", "2nd: Quantitative Chemistry",
    "2nd: Electrochemistry", "2nd: Economic Chemistry"
  ]);
  sub("hsc_bio", "Biology (Botany & Zoology)", "জীববিজ্ঞান (উদ্ভিদ ও প্রাণী)", "🌿", [
    "Botany: Cell & Its Structure", "Botany: Cell Division", "Botany: Cell Chemistry", "Botany: Microorganisms",
    "Botany: Algae & Fungi", "Botany: Bryophyta & Pteridophyta", "Botany: Gymnosperm & Angiosperm",
    "Botany: Tissue & Tissue System", "Botany: Plant Physiology", "Botany: Plant Reproduction",
    "Botany: Biotechnology", "Botany: Organism & Environment",
    "Zoology: Animal Diversity & Classification", "Zoology: Introduction to Animals", "Zoology: Digestion & Absorption",
    "Zoology: Blood & Circulation", "Zoology: Respiration", "Zoology: Excretion & Osmoregulation",
    "Zoology: Locomotion & Movement", "Zoology: Coordination & Control", "Zoology: Continuity of Life",
    "Zoology: Immunity", "Zoology: Genetics & Evolution", "Zoology: Animal Behaviour"
  ]);
  sub("hsc_hmath", "Higher Math (1st & 2nd)", "উচ্চতর গণিত (১ম ও ২য়)", "∑", [
    "1st: Matrices & Determinants", "1st: Vectors", "1st: Straight Lines", "1st: Circles",
    "1st: Permutations & Combinations", "1st: Trigonometric Ratios", "1st: Trig Ratios of Associated Angles",
    "1st: Functions & Graphs", "1st: Differentiation", "1st: Integration",
    "2nd: Real Numbers & Inequalities", "2nd: Linear Programming", "2nd: Complex Numbers",
    "2nd: Polynomials & Polynomial Equations", "2nd: Binomial Expansion", "2nd: Conics",
    "2nd: Inverse Trig Functions & Equations", "2nd: Statics", "2nd: Motion in a Plane", "2nd: Dispersion & Probability"
  ]);
  sub("hsc_ict", "ICT", "তথ্য ও যোগাযোগ প্রযুক্তি", "⌨", [
    "ICT: World & Bangladesh Perspective", "Communication Systems & Networking", "Number Systems & Digital Devices",
    "Web Design & HTML", "Programming Language (C)", "Database Management System"
  ]);
  sub("hsc_acc", "Accounting (1st & 2nd)", "হিসাববিজ্ঞান (১ম ও ২য়)", "₹", [
    "Accounting Concepts", "Recording Transactions", "Bank Reconciliation Statement", "Depreciation",
    "Rectification of Errors", "Worksheet", "Financial Statements", "Non-profit Organizations",
    "Partnership Accounts", "Company Accounts", "Cost Accounting"
  ]);
  sub("hsc_bom", "Business Org. & Management", "ব্যবসায় সংগঠন ও ব্যবস্থাপনা", "💼", [
    "Business Environment", "Forms of Business", "Management Concepts", "Planning", "Organizing",
    "Staffing", "Directing & Motivation", "Coordination & Control"
  ]);
  sub("hsc_fin", "Finance, Banking & Insurance", "ফিন্যান্স, ব্যাংকিং ও বিমা", "৳", [
    "Introduction to Finance", "Financial Markets", "Time Value of Money", "Risk & Return",
    "Capital Budgeting", "Banking", "Insurance"
  ]);
  sub("hsc_mkt", "Production Mgmt. & Marketing", "উৎপাদন ব্যবস্থাপনা ও বিপণন", "📦", [
    "Production & Productivity", "Production Planning", "Marketing Concepts", "Marketing Mix (4P)",
    "Product & Pricing", "Distribution & Promotion"
  ]);
  sub("hsc_eco", "Economics (1st & 2nd)", "অর্থনীতি (১ম ও ২য়)", "📈", [
    "Basic Concepts", "Consumer Behaviour & Demand", "Production & Cost", "Market Structure", "National Income",
    "Money, Banking & Inflation", "Economy of Bangladesh", "Agriculture & Industry of Bangladesh"
  ]);
  sub("hsc_civ", "Civics & Good Governance", "পৌরনীতি ও সুশাসন", "⚖", [
    "Civics & Political Science", "State, Society & Government", "Law, Liberty & Equality", "Good Governance",
    "Political Thinkers", "Constitution of Bangladesh"
  ]);
  sub("hsc_his", "History", "ইতিহাস", "🏛", [
    "Ancient India & Bengal", "Sultanate Period", "Mughal Period", "British Rule & Movements", "Pakistan Period & Liberation"
  ]);
  sub("hsc_log", "Logic", "যুক্তিবিদ্যা", "∴", [
    "Introduction to Logic", "Terms & Propositions", "Deductive Reasoning & Syllogism", "Inductive Reasoning", "Fallacies"
  ]);
  sub("hsc_soc", "Sociology", "সমাজবিজ্ঞান", "👥", [
    "Introduction to Sociology", "Society & Social Groups", "Culture & Socialization", "Social Institutions", "Social Problems"
  ]);

  /* ---------- Admission extras ---------- */
  sub("gk_bd", "General Knowledge: Bangladesh", "সাধারণ জ্ঞান: বাংলাদেশ", "🇧🇩", [
    "History & Liberation War", "Geography & Resources", "Constitution & Government", "Economy & Development",
    "Culture, Literature & Heritage", "National Symbols & Firsts"
  ]);
  sub("gk_int", "General Knowledge: International", "সাধারণ জ্ঞান: আন্তর্জাতিক", "🌐", [
    "World Geography", "International Organizations", "World History", "Science & Technology", "Sports & Events"
  ]);

  /* ---------- Exam → group → subjects ---------- */
  const EXAMS = {
    SSC: {
      en: "SSC", bn: "এসএসসি",
      groups: {
        science: ["ban", "eng", "ssc_math", "ssc_phy", "ssc_che", "ssc_bio", "ssc_hmath", "ssc_ict", "ssc_bgs"],
        business: ["ban", "eng", "ssc_math", "ssc_acc", "ssc_fin", "ssc_bus", "ssc_ict", "ssc_bgs"],
        humanities: ["ban", "eng", "ssc_math", "ssc_his", "ssc_geo", "ssc_civ", "ssc_eco", "ssc_ict", "ssc_bgs"]
      }
    },
    HSC: {
      en: "HSC", bn: "এইচএসসি",
      groups: {
        science: ["ban", "eng", "hsc_phy", "hsc_che", "hsc_bio", "hsc_hmath", "hsc_ict"],
        business: ["ban", "eng", "hsc_acc", "hsc_bom", "hsc_fin", "hsc_mkt", "hsc_eco", "hsc_ict"],
        humanities: ["ban", "eng", "hsc_civ", "hsc_eco", "hsc_his", "hsc_log", "hsc_soc", "hsc_ict"]
      }
    },
    ADM: {
      en: "Admission", bn: "ভর্তি পরীক্ষা",
      targets: {
        du_a: { en: "DU – Science Unit", bn: "ঢাবি – বিজ্ঞান ইউনিট", subs: ["hsc_phy", "hsc_che", "hsc_bio", "hsc_hmath", "ban", "eng"], neg: 0.25 },
        du_b: { en: "DU – Arts Unit", bn: "ঢাবি – কলা ইউনিট", subs: ["ban", "eng", "gk_bd", "gk_int"], neg: 0.25 },
        du_c: { en: "DU – Business Unit", bn: "ঢাবি – ব্যবসায় ইউনিট", subs: ["hsc_acc", "hsc_bom", "hsc_fin", "hsc_mkt", "ban", "eng"], neg: 0.25 },
        engg: { en: "Engineering (BUET/CKRUET)", bn: "ইঞ্জিনিয়ারিং (বুয়েট/চুয়েট-কুয়েট-রুয়েট)", subs: ["hsc_phy", "hsc_che", "hsc_hmath", "eng"], neg: 0 },
        med: { en: "Medical (MBBS/BDS)", bn: "মেডিকেল (MBBS/BDS)", subs: ["hsc_bio", "hsc_che", "hsc_phy", "eng", "gk_bd"], neg: 0.25 },
        gst_sci: { en: "GST Cluster – Science", bn: "গুচ্ছ – বিজ্ঞান", subs: ["hsc_phy", "hsc_che", "hsc_bio", "hsc_hmath", "ban", "eng"], neg: 0.25 },
        gst_arts: { en: "GST Cluster – Humanities", bn: "গুচ্ছ – মানবিক", subs: ["ban", "eng", "gk_bd", "gk_int"], neg: 0.25 },
        gst_bus: { en: "GST Cluster – Business", bn: "গুচ্ছ – ব্যবসায়", subs: ["hsc_acc", "hsc_bom", "hsc_fin", "ban", "eng"], neg: 0.25 }
      }
    }
  };

  const GROUPS = {
    science: { en: "Science", bn: "বিজ্ঞান" },
    business: { en: "Business Studies", bn: "ব্যবসায় শিক্ষা" },
    humanities: { en: "Humanities", bn: "মানবিক" }
  };

  const BOARDS = ["Dhaka", "Rajshahi", "Cumilla", "Jashore", "Chattogram", "Barishal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah", "Technical"];

  /* Announced start dates (editable by the student in Settings). */
  const DEFAULT_DATES = { SSC: "2027-03-14", HSC: "2027-06-06", ADM: "" };

  return { SUBJECTS: S, EXAMS, GROUPS, BOARDS, DEFAULT_DATES };
})();
