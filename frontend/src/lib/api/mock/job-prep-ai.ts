import "server-only";

export interface JobPrepInput {
  role?: string;
  company?: string;
  weeks?: string | number;
}

interface RoleCurriculum {
  requiredSkills: string[];
  stages: Array<{
    technical: string;
    aptitude: string;
    interview: string;
  }>;
  resumeTip: string;
  portfolioTip: string;
  companySpecificHacks: Record<string, string>;
}

const ROLE_DATA: Record<string, RoleCurriculum> = {
  "Data Scientist": {
    requiredSkills: ["Python (Pandas, NumPy, Scipy)", "Statistics & Probability", "Machine Learning (Scikit-Learn)", "SQL & Feature Engineering", "Deep Learning basics (PyTorch/TF)"],
    stages: [
      { technical: "Python data structures, Pandas data wrangling & NumPy vectorization", aptitude: "Descriptive Statistics, Probability distributions & Bayes theorem", interview: "Explain bias-variance tradeoff & overfitting with real examples" },
      { technical: "Exploratory Data Analysis (EDA), Data Cleaning & SQL Window functions", aptitude: "Hypothesis testing (p-values, Z-test, T-test, ANOVA)", interview: "Walk through end-to-end data pipeline from raw logs to tables" },
      { technical: "Supervised ML: Linear/Logistic Regression, Decision Trees, Random Forests", aptitude: "Combinatorics, Permutations & Business estimation cases", interview: "STAR story: Handling dirty/missing data in a past project" },
      { technical: "Ensemble techniques: XGBoost, LightGBM & Hyperparameter tuning", aptitude: "Correlation vs Causation, Metric selection (Precision, Recall, F1, ROC-AUC)", interview: "Defend metric choice: Why optimize F1 over Accuracy in fraud detection?" },
      { technical: "Unsupervised ML: K-Means, PCA, Hierarchical clustering & Dimensionality reduction", aptitude: "Matrix algebra, Eigenvalues & Dimensionality intuition", interview: "Technical presentation drill: Explaining ML to non-technical stakeholders" },
      { technical: "Deep Learning basics: Neural Networks, Activation functions, Backprop", aptitude: "Loss function optimization (SGD, Adam) & gradient descent nuances", interview: "Mock Technical Interview: Deep dive into ML architecture & modeling choices" },
      { technical: "MLOps basics: Model serialization (Joblib/ONNX), Flask/FastAPI serving, Docker", aptitude: "System load estimation & batch vs real-time inference trade-offs", interview: "System Design for ML: Recommender system or news feed ranking design" },
      { technical: "Company past year assessments, Kaggle case studies & Model evaluation drills", aptitude: "Timed full-length technical aptitude mock & speed tests", interview: "2 Full Mock Interviews (Live coding in Python/SQL + Behavioral HR round)" },
    ],
    resumeTip: "Quantify ML impact: e.g. 'Improved churn prediction ROC-AUC by 14% using XGBoost with custom feature engineering'.",
    portfolioTip: "Publish a GitHub repo with clean EDA notebooks, deployed Streamlit demo app, and README with architectural diagrams.",
    companySpecificHacks: {
      "it services": "Focus heavily on SQL joins, basic Python coding, foundation Statistics, and TCS NQT / Infosys pseudo-code aptitude.",
      "product company": "High bar on Linear Algebra, mathematical derivations of algorithms, LeetCode Mediums (Trees, DP), and scalable ML system design.",
      "startup": "Build and deploy live Streamlit/Gradio apps on Hugging Face / Vercel. Be ready to write clean production Python.",
      "psu / government": "Review GATE CS/DA syllabus, standard Computer Science fundamentals, DBMS, and quantitative aptitude.",
    },
  },
  "Data Analyst": {
    requiredSkills: ["Advanced SQL (Joins, CTEs, Window Functions)", "BI Dashboards (Power BI / Tableau)", "Excel (VLOOKUP, Pivot Tables, Power Query)", "Exploratory Data Analysis in Python", "Business Communication"],
    stages: [
      { technical: "Advanced Excel: XLOOKUP, Index-Match, Nested Formulas & Pivot Tables", aptitude: "Percentages, Averages, Profit & Loss, Ratio & Proportions", interview: "Introduce yourself and explain a data insight that influenced a decision" },
      { technical: "SQL Fundamentals: SELECT, WHERE, GROUP BY, HAVING, AGGREGATE functions", aptitude: "Data Interpretation (Bar charts, Pie charts, Table reading drills)", interview: "STAR story: Solving a confusing business discrepancy in data" },
      { technical: "Advanced SQL: INNER/LEFT/FULL Joins, Subqueries & Common Table Expressions (CTEs)", aptitude: "Time & Work, Pipes & Cisterns, Speed & Distance", interview: "Walk through optimizing a slow-running SQL query" },
      { technical: "SQL Window Functions: RANK(), DENSE_RANK(), ROW_NUMBER(), LEAD(), LAG()", aptitude: "Permutations, Combinations & Basic Probability", interview: "Explain difference between WHERE and HAVING with edge cases" },
      { technical: "Power BI / Tableau: Data modeling, Star schema, Relationships & Calculated columns", aptitude: "Critical reasoning, Syllogisms & Logic puzzles", interview: "Mock Business Stakeholder meeting: Presenting a churn dashboard" },
      { technical: "DAX in Power BI: CALCULATE, FILTER, Time Intelligence functions", aptitude: "Number series, Blood relations & Seating arrangement puzzles", interview: "Explain how you ensure data integrity and prevent double-counting" },
      { technical: "Python for Analytics: Pandas DataFrames, Matplotlib & Seaborn visualizations", aptitude: "Speed math tricks & timed company quantitative tests", interview: "Technical explanation drill: Explaining correlation vs regression" },
      { technical: "End-to-end Dashboard project review, SQL coding speed tests & Company PYQs", aptitude: "Full-length mock analytical tests & company OA simulations", interview: "2 Full Mocks: Live SQL query round on HackerRank + HR fit round" },
    ],
    resumeTip: "Lead with business metrics: 'Created automated Power BI dashboard tracking 40+ sales KPIs, saving 8 manual reporting hours weekly'.",
    portfolioTip: "Host interactive Tableau Public or Power BI portfolio links showing clean UX, clear filters, and executive summaries.",
    companySpecificHacks: {
      "it services": "Master SQL aggregations, Excel formulas, and standard cognitive aptitude. Expect basic SQL interview questions.",
      "product company": "Strong emphasis on product analytics (A/B test analysis, funnel metrics, cohort retention) and complex SQL window functions.",
      "startup": "Versatility is key: show ability to extract data from raw APIs/Postgres, clean it in Python, and build instant dashboards.",
      "psu / government": "Focus on numerical ability, general awareness, standard arithmetic, and data interpretation charts.",
    },
  },
  "Cloud Engineer": {
    requiredSkills: ["Linux CLI & Bash Scripting", "Networking (TCP/IP, DNS, VPC, Subnets)", "AWS / Azure / GCP core services", "Docker & Containerization", "Terraform (IaC) & CI/CD"],
    stages: [
      { technical: "Linux administration, file permissions, systemd, process management & Bash scripts", aptitude: "Binary math, Subnetting calculations (CIDR notation) & Logical reasoning", interview: "Explain how DNS resolution works step-by-step from browser to server" },
      { technical: "Computer Networks: OSI model, TCP vs UDP, HTTP/S, SSL/TLS, Firewalls & Load Balancers", aptitude: "Flowchart analysis, Scheduling logic & Resource allocation puzzles", interview: "Troubleshoot: 'A server is unreachable via SSH' — what steps do you take?" },
      { technical: "Cloud Core (AWS/Azure): Compute (EC2/VM), Storage (S3/Blob), IAM policies & Security Groups", aptitude: "Time & Work, Cost estimation problems (Cloud billing math)", interview: "Explain Principle of Least Privilege in IAM with concrete examples" },
      { technical: "Cloud Networking: VPC, Public/Private Subnets, NAT Gateways, Route Tables & Peering", aptitude: "Fault-tolerance trees & High Availability architecture puzzles", interview: "STAR story: Managing a system failure or outage during project testing" },
      { technical: "Containerization: Dockerfile creation, multi-stage builds, Docker Compose & networking", aptitude: "Logical sequencing, Critical path analysis & Dependency graphs", interview: "Differentiate Docker containers from Virtual Machines with kernel details" },
      { technical: "Container Orchestration basics: Kubernetes Pods, Deployments, Services & Ingress", aptitude: "System throughput and latency trade-off calculations", interview: "Explain rolling updates vs blue-green deployment strategies" },
      { technical: "Infrastructure as Code: Terraform HCL syntax, State files, Plan/Apply & GitHub Actions CI/CD", aptitude: "Disaster Recovery scenario evaluations (RTO & RPO concepts)", interview: "Mock Cloud Architectural Review: Designing a 3-tier resilient web app" },
      { technical: "Security hardening, AWS Well-Architected framework review & Company mock practicals", aptitude: "Timed cloud practitioner quiz & company quantitative aptitude", interview: "2 Full Mocks: Infrastructure live design drill + HR behavioral round" },
    ],
    resumeTip: "Highlight production practices: 'Provisioned multi-AZ AWS VPC with auto-scaling EC2 and Terraform, achieving 99.9% uptime'.",
    portfolioTip: "Link a GitHub repository with clean Terraform modules, Dockerfiles, and a visual network topology diagram.",
    companySpecificHacks: {
      "it services": "Certifications (AWS Cloud Practitioner / Solutions Architect Associate) give massive weightage. Expect Linux commands & networking.",
      "product company": "Deep dive into Linux internals, kernel cgroups, distributed systems reliability, and Kubernetes debugging.",
      "startup": "Practical hands-on setup: automating deployments with Docker, GitHub Actions, and cost-effective cloud hosting.",
      "psu / government": "CS fundamentals (OS, Networks, Computer Architecture) and standard government recruitment aptitude.",
    },
  },
  "Product Manager": {
    requiredSkills: ["Product Sense & User Journey Mapping", "Product Metrics (North Star, CAC, LTV, Churn)", "PRD (Product Requirements Document) writing", "Wireframing & UX basics (Figma)", "A/B Testing & Data-informed Prioritization"],
    stages: [
      { technical: "Product fundamentals: Problem discovery, User personas, Pain-point identification", aptitude: "Market sizing (Guesstimates): e.g. 'Estimate daily Uber rides in Bangalore'", interview: "What is your favorite mobile app, and how would you improve it by 10%?" },
      { technical: "Feature ideation, User journey mapping & Wireframing (Figma / Balsamiq)", aptitude: "Profitability & Unit Economics (CAC, LTV, Payback period math)", interview: "Walk through how you handle conflicting feature requests from 2 key stakeholders" },
      { technical: "PRD writing: Background, Objective, User stories, Acceptance criteria, Edge cases", aptitude: "Prioritization frameworks: RICE, MoSCoW, Kano Model exercises", interview: "STAR story: Leading a multidisciplinary team through ambiguity" },
      { technical: "Product Analytics: Funnel conversion, Retention cohorts & North Star Metric definition", aptitude: "Data interpretation & Metric diagnosis: 'Daily active users dropped by 15%, why?'", interview: "Defend your choice of North Star metric for Spotify vs YouTube" },
      { technical: "A/B Testing: Hypothesis formulation, Sample size calculation, Significance & Guardrail metrics", aptitude: "Statistical significance concepts, Type I / Type II errors in business", interview: "Design an experiment to test whether removing passwords increases conversion" },
      { technical: "Technical fluency for PMs: APIs, Client-Server architecture, Microservices & Latency basics", aptitude: "Go-to-Market (GTM) strategy: Launch channels, Pricing & Positioning", interview: "Explain how an API works to a 10-year-old and to an engineering lead" },
      { technical: "Product Teardowns: Analyzing competitors, Flywheel models & Network effects", aptitude: "Scenario-based conflict resolution & Stakeholder management drills", interview: "Mock Product Design Interview: 'Design an ATM for blind people'" },
      { technical: "Portfolio review (2 comprehensive PRDs), Case study presentations & Executive pitch decks", aptitude: "Comprehensive product case study analysis under 45-minute timed pressure", interview: "2 Full Mocks: Product Sense & Execution round + Leadership HR interview" },
    ],
    resumeTip: "Focus on user and business impact: 'Spearheaded user onboarding redesign, reducing time-to-first-value by 35% and improving D7 retention by 18%'.",
    portfolioTip: "Publish a Notion or PDF portfolio showcasing 2 in-depth PRDs, teardowns of popular products, and interactive Figma wireframes.",
    companySpecificHacks: {
      "it services": "Focus on Agile/Scrum methodologies, JIRA workflows, client stakeholder communication, and functional requirement specs.",
      "product company": "High-rigor Product Sense, Root Cause Analysis, and Metric Optimization rounds (Stripe/Swiggy/Razorpay style).",
      "startup": "Generalist hustle: execution speed, rapid customer interview synthesis, and zero-to-one MVP scoping.",
      "psu / government": "Public sector digitalization, citizen charter adherence, large-scale accessibility, and governance ethics.",
    },
  },
  "Core Engineering (GET)": {
    requiredSkills: ["Core Discipline Fundamentals (Mech/Civil/ECE/EEE)", "Engineering Design & CAD / Simulation tools", "Industry Standards & Quality Control (ISO, Six Sigma)", "Manufacturing / Field processes", "Technical Problem Solving"],
    stages: [
      { technical: "Discipline fundamentals: Thermodynamics / Structural Mechanics / Circuit Theory / Signals", aptitude: "Engineering mathematics: Differential calculus, Vectors & Numerical methods", interview: "Explain the working principle of the primary machine or circuit in your core branch" },
      { technical: "Material Science, Strength of Materials & Component selection criteria", aptitude: "Mechanical / Electrical reasoning, Spatial visualization & Gear/Pulley physics", interview: "STAR story: Overcoming a major design constraint in your final year lab project" },
      { technical: "CAD & Simulation software (AutoCAD / SolidWorks / MATLAB / ANSYS / SPICE)", aptitude: "Data interpretation (Engineering performance curves, Stress-strain charts)", interview: "Walk through tolerances, safety factors, and failure modes in your CAD model" },
      { technical: "Manufacturing processes / Power systems / Embedded controllers & Sensors", aptitude: "Quantitative aptitude: Time, Speed, Work, Ratio & Percentage calculations", interview: "Troubleshoot: Identifying thermal runaway or vibration resonance in a system" },
      { technical: "Quality assurance: GD&T, Lean manufacturing, Six Sigma & Root Cause Analysis (5-Whys)", aptitude: "Critical reasoning, Fault trees & Industrial safety logic puzzles", interview: "Explain why standard components are preferred over custom fabrication" },
      { technical: "Industrial Automation: PLC/SCADA basics, IoT in core industry & Microcontrollers", aptitude: "Basic electronics and sensor interfacing questions", interview: "How do you justify upgrading an existing legacy plant process economically?" },
      { technical: "Company past technical interview papers, GATE core revision & Standards review", aptitude: "Timed core technical objective tests & company-specific pattern mocks", interview: "Mock Technical Viva: Defending engineering calculations on a whiteboard" },
      { technical: "Final year project technical defense, Plant visit learnings & Domain PYQs", aptitude: "Full mock assessment test (Technical + Quantitative + English)", interview: "2 Full Mocks: Technical Panel Interview + HR managerial round" },
    ],
    resumeTip: "Emphasize hands-on technical projects: 'Designed planetary gearbox in SolidWorks with ANSYS FEA, reducing stress concentrations by 22%'.",
    portfolioTip: "Prepare a physical or digital portfolio with CAD blueprints, FEA heatmaps, circuit schematics, and photos of fabricated prototypes.",
    companySpecificHacks: {
      "it services": "Many IT service firms test core engineers for analytical aptitude and basic C/Python programming alongside logical reasoning.",
      "product company": "Deep technical rigor: expect derivations from first principles, manufacturing trade-offs, and physical prototyping tests.",
      "startup": "End-to-end prototyping: PCB design, 3D printing, firmware flashing, and rapid iterative hardware testing.",
      "psu / government": "Strict adherence to GATE exam syllabus, PSU objective papers (ISRO, BHEL, IOCL, NTPC), and general studies.",
    },
  },
  "Software Engineer": {
    requiredSkills: ["Data Structures & Algorithms (LeetCode Medium)", "Object-Oriented Programming (Java/C++/Python)", "Database Systems & SQL Optimization", "Low-Level & High-Level System Design", "Operating Systems & Networking"],
    stages: [
      { technical: "Arrays, Strings, Two Pointers, Sliding Window & Hash Maps", aptitude: "Percentages, Ratios, Speed & Distance, Averages", interview: "Explain time & space complexity of QuickSort vs MergeSort with worst cases" },
      { technical: "Recursion, Linked Lists, Stacks, Queues & Monotonic Stack patterns", aptitude: "Time & Work, Pipes & Cisterns, Permutations & Combinations", interview: "STAR story: Debugging a hard memory leak or edge-case bug under deadline" },
      { technical: "Trees: Binary Trees, BST, DFS/BFS traversals, LCA & Path Sum problems", aptitude: "Probability, Profit & Loss, Number theory & Modular arithmetic", interview: "Demonstrate OOP principles (Polymorphism, Abstraction) using real code" },
      { technical: "Graphs: BFS/DFS, Dijkstra, Topological Sort & Disjoint Set Union (DSU)", aptitude: "Logical puzzles, Seating arrangements, Syllogisms & Blood relations", interview: "Explain difference between Process and Thread, Mutex and Semaphore" },
      { technical: "Dynamic Programming: 1D DP, Knapsack variations, Longest Common Subsequence", aptitude: "Data interpretation & speed math drills", interview: "Explain ACID properties in databases and how indexing B-Trees speed up queries" },
      { technical: "Advanced SQL: Window functions, Indexing strategies & Query optimization", aptitude: "Critical reasoning & pseudo-code debugging questions", interview: "Design a Rate Limiter or URL Shortener (High-Level System Design drill)" },
      { technical: "Low-Level Design: Design Patterns (Factory, Singleton, Strategy, Observer)", aptitude: "Timed online coding test simulations (HackerRank / LeetCode contest)", interview: "Mock Technical Round: Live coding on Google Docs without IDE auto-complete" },
      { technical: "Company past year OA questions, LeetCode top 150 revision & Core CS revision", aptitude: "Full mock technical assessments & time-bounded tests", interview: "2 Full Mocks: 1 Live DSA Coding Round + 1 Leadership / HR cultural fit" },
    ],
    resumeTip: "Quantify engineering achievements: 'Architected microservices caching layer with Redis, reducing API p99 latency from 450ms to 65ms'.",
    portfolioTip: "Provide live deployment URLs and clean GitHub repos with CI/CD badges, unit test coverage (>80%), and detailed architecture diagrams.",
    companySpecificHacks: {
      "it services": "TCS Digital, Infosys HackWithInfy, and Cognizant prioritize arrays, strings, basic OOPs, and speed in clearing initial aptitude filters.",
      "product company": "High standard on LeetCode Medium/Hard, clean modular code, concurrent programming, and scalability trade-offs.",
      "startup": "Fullstack capabilities: React/Next.js frontend, Node/Go/Python backend, Postgres, Docker, and demonstrated passion for shipping fast.",
      "psu / government": "CS fundamentals (Compiler design, Automata theory, DBMS, OS, Computer Organization) matching GATE pattern.",
    },
  },
};

export function generateJobPrepPlan(roleRaw?: string, companyRaw?: string, weeksRaw?: string | number): string {
  const roleKey = Object.keys(ROLE_DATA).find((k) => k.toLowerCase() === (roleRaw ?? "").toLowerCase().trim()) ?? "Software Engineer";
  const data = ROLE_DATA[roleKey] ?? ROLE_DATA["Software Engineer"]!;
  
  const companyKey = (companyRaw ?? "Product company").toLowerCase().trim();
  const companyHack = Object.entries(data.companySpecificHacks).find(([k]) => companyKey.includes(k))?.[1] ??
    `Tailor your preparation to the specific evaluation rubric and tech stack of ${companyRaw || "the hiring company"}.`;

  const totalWeeks = Math.min(Math.max(parseInt(String(weeksRaw ?? 8), 10) || 8, 2), 24);

  // Distribute the 8 stages over totalWeeks
  const scheduleRows: string[] = [];
  const stagesCount = data.stages.length;

  for (let w = 1; w <= totalWeeks; w++) {
    // Map week w to one of the 8 curriculum stages
    const stageIdx = Math.min(Math.floor(((w - 1) / totalWeeks) * stagesCount), stagesCount - 1);
    const stage = data.stages[stageIdx]!;
    
    // Label week range or single week
    const weekLabel = `Week ${w}`;
    scheduleRows.push(`| **${weekLabel}** | ${stage.technical} | ${stage.aptitude} | ${stage.interview} |`);
  }

  const roleTitle = roleRaw || "Software Engineer";
  const companyTitle = companyRaw || "Product Company";

  return `### 🎯 ${totalWeeks}-Week Preparation Plan — ${roleTitle} at ${companyTitle}

**Core Competencies Evaluated:**
${data.requiredSkills.map((s) => `• ${s}`).join("\n")}

---

#### 📅 Weekly Milestone Schedule

| Timeline | Technical Mastery & Domain Prep | Aptitude & Analytical Problem Solving | Interview & Communication Drills |
| :--- | :--- | :--- | :--- |
${scheduleRows.join("\n")}

---

#### 💡 Company-Specific Strategy (${companyTitle})
> **Insider Tip:** ${companyHack}

---

#### 📄 Resume & Portfolio Optimization
- **Resume Impact:** ${data.resumeTip}
- **Portfolio Showcase:** ${data.portfolioTip}

_💡 AI-generated roadmap tailored for ${roleTitle} roles at ${companyTitle}._`;
}
