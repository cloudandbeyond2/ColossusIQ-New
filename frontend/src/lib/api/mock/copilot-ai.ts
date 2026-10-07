import "server-only";

/**
 * Intelligent topic analysis to extract domain, keywords, and domain-specific terminology.
 */
interface TopicDomainInfo {
  domain: "dsa" | "os" | "dbms" | "networks" | "software" | "ai" | "math" | "electronics" | "general";
  keywords: string[];
  sampleProblem: string;
  sampleExample: string;
  keyTerminology: string[];
  vivaQuestion: string;
  vivaAnswer: string;
}

function analyzeTopic(rawTopic: string): TopicDomainInfo {
  const t = rawTopic.toLowerCase();

  if (/tree|graph|heap|stack|queue|array|hash|sort|search|linked list|algorithm|dsa|recursion|dynamic programming|greedy|complexity|big o/i.test(t)) {
    return {
      domain: "dsa",
      keywords: ["Time & Space Complexity", "Edge Cases (empty/null)", "Pointer manipulation / Traversal", "Invariants & State"],
      sampleProblem: `Given an input dataset, implement an optimal traversal and manipulation routine for ${rawTopic} that achieves minimal time complexity O(N log N) or O(N).`,
      sampleExample: `Tracing execution on sample inputs: [14, 3, 27, 8, 42, 19] — step-by-step state transition and pointer updates.`,
      keyTerminology: ["Worst-case O(N)", "Auxiliary Memory", "Base Case", "Boundary Condition"],
      vivaQuestion: `What is the worst-case space and time complexity of ${rawTopic}, and in what scenario does the worst case occur?`,
      vivaAnswer: `The worst case typically occurs with degenerate input distributions (e.g. sorted arrays or skewed trees), degrading efficiency unless self-balancing or randomized pivots are used.`,
    };
  }

  if (/os|process|thread|deadlock|semaphore|mutex|memory management|paging|virtual memory|scheduling|kernel|concurrency|race condition/i.test(t)) {
    return {
      domain: "os",
      keywords: ["Context Switching", "Synchronization Primitives", "Resource Allocation Graph", "Thrashing & Page Replacement"],
      sampleProblem: `Simulate resource allocation and identify whether a deadlock or race condition occurs under concurrent execution of 3 threads with shared locks.`,
      sampleExample: `Processes P1, P2, P3 requesting resources R1, R2. Allocation matrix analysis showing safe sequence <P2, P1, P3>.`,
      keyTerminology: ["Mutual Exclusion", "Hold and Wait", "Preemption", "Circular Wait"],
      vivaQuestion: `How does the operating system detect and resolve resource contention in ${rawTopic}?`,
      vivaAnswer: `Via avoidance algorithms (like Banker's algorithm) or detection using wait-for graphs and preemptive recovery mechanisms.`,
    };
  }

  if (/database|dbms|sql|normalization|acid|transaction|relational|nosql|query|b\+ tree|indexing|functional dependency/i.test(t)) {
    return {
      domain: "dbms",
      keywords: ["Functional Dependencies", "Lossless Join Decomposition", "ACID Compliance", "B+ Tree Indexing"],
      sampleProblem: `Given relation R(A, B, C, D, E) with dependencies {A → B, BC → D, D → E}, determine candidate keys and decompose to BCNF.`,
      sampleExample: `College student enrollment schema: Student(RollNo, Name, DeptId, DeptName, CourseId, Grade) decomposing to eliminate update and deletion anomalies.`,
      keyTerminology: ["Primary & Foreign Key", "Transitive Dependency", "Serializability", "Write-Ahead Logging"],
      vivaQuestion: `Explain the fundamental difference between 3NF and BCNF with respect to candidate keys in ${rawTopic}.`,
      vivaAnswer: `In 3NF, the RHS may be a prime attribute if LHS is not a superkey; BCNF strictly requires the LHS of every non-trivial FD to be a superkey.`,
    };
  }

  if (/network|tcp|ip|osi|routing|protocol|packet|dns|http|udp|socket|congestion|subnet/i.test(t)) {
    return {
      domain: "networks",
      keywords: ["Three-way Handshake", "Flow & Congestion Control", "Packet Encapsulation", "Routing Convergence"],
      sampleProblem: `Calculate subnet masks and route hops between subnet 192.168.1.0/24 and 10.0.0.0/16 across 3 router hops using Dijkstra's shortest path.`,
      sampleExample: `Capturing Wireshark packet sequence for TCP SYN, SYN-ACK, ACK and tracing sliding window acknowledgment increments.`,
      keyTerminology: ["Round Trip Time (RTT)", "Sliding Window", "Checksum Verification", "TTL & Hop Count"],
      vivaQuestion: `How does flow control differ from congestion control in the context of ${rawTopic}?`,
      vivaAnswer: `Flow control prevents the sender from overwhelming the receiver's buffer; congestion control prevents all network senders from overwhelming intermediate router queues.`,
    };
  }

  if (/software|agile|scrum|design pattern|mvc|rest|api|testing|git|ci\/cd|microservice|clean architecture|refactor/i.test(t)) {
    return {
      domain: "software",
      keywords: ["Separation of Concerns", "Design Patterns", "Unit Testing & Mocking", "CI/CD Pipeline"],
      sampleProblem: `Design a scalable microservice architecture for ${rawTopic} incorporating caching, circuit breaking, and event-driven messaging.`,
      sampleExample: `Refactoring a monolithic module into decoupled controllers, service layer, and repository pattern with automated unit test coverage.`,
      keyTerminology: ["Loose Coupling", "High Cohesion", "Idempotency", "Test Coverage"],
      vivaQuestion: `What architectural trade-offs are introduced when applying ${rawTopic} in production systems?`,
      vivaAnswer: `It provides modularity and maintainability but introduces network latency, distributed state management challenges, and deployment complexity.`,
    };
  }

  if (/machine learning|ai|deep learning|neural|classification|regression|clustering|nlp|transformer|llm|feature/i.test(t)) {
    return {
      domain: "ai",
      keywords: ["Overfitting & Regularization", "Gradient Descent Optimization", "Loss Function Selection", "Cross-Validation"],
      sampleProblem: `Given a tabular dataset with high dimensionality, train an optimized model for ${rawTopic} while preventing data leakage and overfitting.`,
      sampleExample: `Training a classifier on 10,000 samples: splitting 80/20 train/test, applying L2 regularization, and evaluating Confusion Matrix and AUC-ROC.`,
      keyTerminology: ["Precision & Recall", "Learning Rate", "Vanishing Gradient", "Feature Scaling"],
      vivaQuestion: `How do you diagnose and mitigate bias versus variance trade-offs in ${rawTopic}?`,
      vivaAnswer: `High bias (underfitting) requires increased model capacity and better features; high variance (overfitting) requires regularization, dropout, or more training data.`,
    };
  }

  // General fallback domain
  return {
    domain: "general",
    keywords: ["Core Principles & Definitions", "Analytical Methodology", "Practical Application & Validation", "Critical Edge-Cases"],
    sampleProblem: `Analyze an end-to-end practical scenario demonstrating the core principles, formulation, and execution of ${rawTopic}.`,
    sampleExample: `Real-world case study applying ${rawTopic} with input parameters, step-by-step derivation, and verified final outcomes.`,
    keyTerminology: ["Foundational Axioms", "Domain Constraints", "Verification Metrics", "Operational Parameters"],
    vivaQuestion: `What are the primary assumptions and operational constraints when implementing ${rawTopic}?`,
    vivaAnswer: `The primary assumptions involve bounded inputs, standardized system environments, and adherence to foundational governing laws of the discipline.`,
  };
}

/**
 * Builds rich, dynamic academic materials for the selected tool, topic, duration, and level.
 */
export async function generateCopilotContent(
  toolRaw: string,
  topicRaw: string,
  durationRaw: string,
  levelRaw: string,
): Promise<string> {
  const tool = (toolRaw || "Lesson plan").trim();
  const topic = (topicRaw || "Database normalization").trim();
  const duration = parseInt(durationRaw, 10) || 45;
  const level = (levelRaw || "UG Year 3").trim();

  // Deterministic, high-fidelity academic generators tailored per tool & topic
  const info = analyzeTopic(topic);
  const normalizedTool = tool.toLowerCase();

  if (normalizedTool.includes("quiz")) {
    return generateQuiz(topic, level, duration, info);
  }

  if (normalizedTool.includes("note") || normalizedTool.includes("lecture notes")) {
    return generateLectureNotes(topic, level, duration, info);
  }

  if (normalizedTool.includes("ppt") || normalizedTool.includes("slide")) {
    return generatePptOutline(topic, level, duration, info);
  }

  if (normalizedTool.includes("assignment")) {
    return generateAssignment(topic, level, info);
  }

  if (normalizedTool.includes("rubric")) {
    return generateRubric(topic, level, info);
  }

  if (normalizedTool.includes("lab manual") || normalizedTool.includes("lab")) {
    return generateLabManual(topic, level, info);
  }

  if (normalizedTool.includes("remedial") || normalizedTool.includes("remedy")) {
    return generateRemedialPlan(topic, level, info);
  }

  // Default: Lesson plan
  return generateLessonPlan(topic, level, duration, info);
}

/* ───────────────────────────── INDIVIDUAL GENERATORS ───────────────────────────── */

function generateQuiz(topic: string, level: string, duration: number, info: TopicDomainInfo): string {
  const quizMinutes = Math.min(Math.max(Math.round(duration * 0.4), 15), 30);
  return `### 📝 Diagnostic & Mastery Quiz: ${topic}
**Class Level:** ${level} | **Time Allowed:** ${quizMinutes} Minutes | **Total Marks:** 20 Marks | **Negative Marking:** None

> [!NOTE]
> Designed for rapid formative assessment and comprehension diagnosis. Answer keys and Bloom's Taxonomy mapping are provided at the end.

---

#### 🔘 Section A: Multiple Choice Questions (4 × 2.5 = 10 Marks)

**Q1. (Remember / Understand)**
Which of the following statements most accurately defines the primary mechanism or objective of **${topic}**?
- **(A)** To eliminate runtime constraints by bypassing hardware-level checks.
- **(B)** To enforce formal invariants, maintain data/state integrity, and eliminate redundancies in system operations.
- **(C)** To trade off correctness for immediate execution throughput regardless of boundary conditions.
- **(D)** To decouple memory management entirely from CPU execution schedules.

**Q2. (Apply / Analyze)**
Consider a system implementing **${topic}** under high workload conditions. When encountering ${info.keywords[1] ?? "edge cases"}, what is the recommended design strategy?
- **(A)** Ignore the boundary conditions and allow the operating runtime to trigger default fallbacks.
- **(B)** Apply defensive isolation, validate pre-conditions, and ensure ${info.keyTerminology[0] ?? "worst-case constraints"} are strictly bounded.
- **(C)** Allocate unbounded dynamic memory buffers until the condition self-resolves.
- **(D)** Immediately terminate all background threads without writing audit checkpoints.

**Q3. (Analyze / Evaluate)**
In the context of **${info.keyTerminology[1] ?? "system architecture"}**, how does **${topic}** impact performance when scaled to large datasets?
- **(A)** It guarantees constant $O(1)$ execution regardless of input distribution.
- **(B)** Performance is governed by ${info.keywords[0] ?? "complexity bounds"}, requiring careful consideration of asymptotic limits.
- **(C)** Memory overhead increases exponentially with linear inputs.
- **(D)** Scalability is completely independent of the underlying algorithmic formulation.

**Q4. (Bloom Level: Apply)**
In an examination of **${info.sampleExample.slice(0, 50)}**, which error is most commonly observed among beginners?
- **(A)** Failing to account for ${info.keyTerminology[2] ?? "base cases"} leading to infinite loops or inconsistent states.
- **(B)** Utilizing too many formal mathematical proofs in production configurations.
- **(C)** Over-optimizing CPU cache lines before verifying logical output.
- **(D)** Declaring all variables as global primitives.

---

#### ✍️ Section B: Short Descriptive & Problem Solving (2 × 5 = 10 Marks)

**Q5. Conceptual Synthesis (5 Marks)**
Briefly explain the underlying theorem or architectural principle behind **${topic}**. Illustrate your explanation with a clean schematic or pseudo-code showing how ${info.keywords[2] ?? "state transitions"} occur.

**Q6. Analytical Application (5 Marks)**
${info.sampleProblem}

---

#### 🔑 Faculty Answer Key & Diagnostic Rationale

| Q# | Key | Bloom Level | Target Concept | Diagnostic Insight |
|---|---|---|---|---|
| **Q1** | **(B)** | Understand | Definition of ${topic} | If student chooses (A), review fundamental definitions. |
| **Q2** | **(B)** | Apply | ${info.keywords[1] ?? "Boundary handling"} | Demonstrates real-world system engineering acumen. |
| **Q3** | **(B)** | Analyze | Performance & Asymptotics | Checks if student understands scaling limits. |
| **Q4** | **(A)** | Evaluate | Common Student Pitfall | Pinpoints misunderstanding of termination invariants. |

*Marking Rubric for Q5 & Q6: 2 marks for valid definition/principle, 2 marks for correct technical execution/schematic, 1 mark for edge-case coverage.*`;
}

function generateLectureNotes(topic: string, level: string, duration: number, info: TopicDomainInfo): string {
  return `### 📖 Comprehensive Lecture Notes: ${topic}
**Target Level:** ${level} | **Lecture Duration:** ${duration} Minutes | **Module:** Core Engineering Curriculum

---

#### 1. Learning Objectives (Bloom's Revised Taxonomy)
By the end of this lecture and self-study session, students will be able to:
1. **Define and State (CO1 / Remember):** Core definitions, governing equations, and axiomatic foundations of **${topic}**.
2. **Explain Mechanisms (CO2 / Understand):** Describe the role of **${info.keywords[0]}** and **${info.keywords[1]}** in system correctness.
3. **Apply & Solve (CO3 / Apply):** Implement or evaluate **${topic}** when presented with non-trivial engineering constraints.
4. **Critique & Optimize (CO4 / Analyze):** Evaluate trade-offs involving ${info.keyTerminology[0]} versus ${info.keyTerminology[1]}.

---

#### 2. Foundational Concepts & Mathematical Formulation
**${topic}** is an essential topic in modern computing and engineering. The core objective is to ensure predictability, efficiency, and verifiable correctness.

> **Formal Definition:**
> In system engineering, **${topic}** represents the formal methodology by which inputs are transformed, verified, and stabilized under governed operational constraints.

##### Key Invariants & Properties
- **Invariant I — Correctness:** The output must satisfy all boundary conditions without violating system state constraints.
- **Invariant II — Efficiency:** Execution bounded by ${info.keywords[0]} to prevent latency degradation.
- **Invariant III — Reliability:** Graceful degradation during edge cases (${info.keyTerminology[2] ?? "boundary conditions"}).

---

#### 3. Step-by-Step Technical Mechanism
The execution pipeline for **${topic}** comprises four disciplined phases:

\`\`\`
[Input Specification] 
       │
       ▼
1. Validation & Pre-processing (Checking ${info.keyTerminology[3] ?? "invariants"})
       │
       ▼
2. Core Transformation & Execution (${info.keywords[2] ?? "algorithmic dispatch"})
       │
       ▼
3. Verification & Boundary Check (${info.keyTerminology[0] ?? "asymptotic validation"})
       │
       ▼
[Verified Stable Output]
\`\`\`

1. **Initialization:** Prepare data structures, allocate necessary registers or memory buffers, and establish base-case guards.
2. **Processing Cycle:** Iterate through elements, enforcing state preservation across transitions.
3. **Termination Guarantee:** Prove that the loop or recursive termination condition decreases monotonically toward the base case.

---

#### 4. Concrete Worked Example
**Problem Statement:**
${info.sampleProblem}

**Step-by-Step Solution:**
1. **Initial Assessment:** Deconstruct the problem parameters. Identify known inputs and boundary constraints.
2. **Execution Walkthrough:**
   - ${info.sampleExample}
3. **Verification:** Validate output against edge conditions (e.g., $N = 0$, $N = 1$, or maximum buffer boundaries).
4. **Complexity Analysis:** Conclude the time and space complexity with formal mathematical justification.

---

#### 5. Common Student Misconceptions & Exam Pitfalls
| Common Mistake | Why It Fails | Correct Engineering Practice |
|---|---|---|
| Overlooking ${info.keyTerminology[2] ?? "base cases"} | Leads to runtime exceptions or non-terminating loops | Always verify boundary states before executing the core loop. |
| Confusing worst-case with average-case | Underestimates real-time system latency | Specifically document $O(N)$ vs $\\Omega(N)$ constraints. |
| Omitting verification checks | Corrupts downstream pipeline data | Implement assertions and validation preconditions. |

---

#### 6. Summary Cheat-Sheet & Quick Revision
- **Core Principle:** ${topic} guarantees verifiable behavior through ${info.keywords[0]}.
- **Crucial Formula / Rule:** Always ensure balanced allocation and check ${info.keyTerminology[1]}.
- **Exam Hot-Spot:** Be prepared to trace ${info.sampleExample.slice(0, 45)} step-by-step.

---

*Recommended Reference: Standard University Syllabus & Course Handouts.*`;
}

function generateLessonPlan(topic: string, level: string, duration: number, info: TopicDomainInfo): string {
  const hookTime = Math.max(5, Math.round(duration * 0.1));
  const conceptTime = Math.round(duration * 0.35);
  const activityTime = Math.round(duration * 0.3);
  const quizTime = Math.round(duration * 0.15);
  const wrapTime = duration - (hookTime + conceptTime + activityTime + quizTime);

  const t1 = `0–${hookTime}`;
  const t2 = `${hookTime}–${hookTime + conceptTime}`;
  const t3 = `${hookTime + conceptTime}–${hookTime + conceptTime + activityTime}`;
  const t4 = `${hookTime + conceptTime + activityTime}–${duration - wrapTime}`;
  const t5 = `${duration - wrapTime}–${duration}`;

  return `### 📋 Master Lesson Plan: ${topic}
**Target Class:** ${level} | **Total Allotted Time:** ${duration} Minutes | **Pedagogical Model:** Active Learning (5E Instructional Framework)

---

#### 🎯 Course Learning Outcomes & Blooms Mapping
- **CO-1 (Understand):** Students can articulate the necessity of **${topic}** in modern systems.
- **CO-2 (Apply):** Students can execute the core technique on standard engineering problems.
- **CO-3 (Evaluate):** Students can identify errors, analyze trade-offs, and defend architectural choices.

---

#### ⏱️ Timed Pedagogical Execution Matrix (${duration} Min)

| Time Window | Pedagogical Stage | Faculty Activity | Student Activity | Teaching Aids |
|---|---|---|---|---|
| **${t1} min** | **Hook & Engage** | Present a real-world system failure caused by neglecting **${topic}** (e.g. data corruption or race condition). | Brainstorm what caused the anomaly; volunteer preliminary fixes. | Interactive Whiteboard / Smart Display |
| **${t2} min** | **Direct Instruction** | Deliver structured theory: foundational definitions, **${info.keywords[0]}**, and architectural blueprints. | Take visual sketch notes; answer interspersed concept-check questions. | Slide Deck (Slides 1–4) & Chalkboard |
| **${t3} min** | **Collaborative Drill** | Distribute challenge problem: **${info.sampleProblem.slice(0, 65)}...** | Work in pairs (Think-Pair-Share) to calculate state transitions and verify output. | Handout Worksheet & Peer Code Review |
| **${t4} min** | **Formative Assessment** | Administer 4-question rapid diagnostic quiz covering **${info.keyTerminology[0]}** and boundary limits. | Submit answers via digital poll or rapid index cards. | Quiz Portal / QR Scan |
| **${t5} min** | **Closure & Exit Ticket** | Summarize core takeaways; assign pre-reading and collect one-sentence exit tickets. | Write down: *"One thing I learned today, and one question I still have."* | LMS Submission / Exit Ticket Box |

---

#### 💡 Formative Concept-Check Prompts (For Faculty During Lecture)
1. *"Can anyone give an intuitive explanation of why ${info.keywords[1]} is critical here?"*
2. *"If we scale our inputs by 10x, what happens to our latency under ${topic}?"*
3. *"Look at Step 3 on the board — what happens if the input is empty or null?"*

---

#### 🔀 Differentiated Instruction & Remedial Strategy
- **For Fast Learners:** Task them with analyzing asynchronous execution or designing a distributed variant of ${topic}.
- **For Slower Learners:** Provide a visual trace card with step-by-step arrows showing ${info.sampleExample.slice(0, 40)}.

---

*Review and adjust timing to match individual class pacing.*`;
}

function generatePptOutline(topic: string, level: string, duration: number, info: TopicDomainInfo): string {
  return `### 🖥️ Slide Deck Outline: ${topic} (10 Master Slides)
**Audience:** ${level} | **Session Length:** ${duration} Minutes | **Format:** High-Impact Technical Presentation

---

#### 🎞️ Slide-by-Slide Blueprint

##### Slide 1: Title & Session Objectives
- **Slide Title:** ${topic}: Principles, Architecture & Applications
- **Subtitle:** Engineering Masterclass · ${level}
- **Visual Asset:** Modern high-contrast header graphic showing interconnected computing nodes.
- **Key Bullet Points:**
  - What problem does ${topic} solve?
  - Learning outcomes (Remember, Apply, Analyze).
- **Faculty Speaker Notes:** *"Welcome everyone. Today we deconstruct ${topic} — not just for the exam, but as a foundational pillar of production software systems."*

##### Slide 2: The Real-World Problem & Motivation
- **Slide Title:** Why Do We Need ${topic}?
- **Visual Asset:** Before-and-after comparison chart showing system failure versus stabilized execution.
- **Key Bullet Points:**
  - The naive approach and its fatal vulnerabilities.
  - Cost of unhandled edge cases in enterprise deployments.
  - The breakthrough insight behind ${topic}.
- **Faculty Speaker Notes:** *"Walk through the real-world case where ignoring this caused massive latency or catastrophic failures."*

##### Slide 3: Theoretical Foundations & Invariants
- **Slide Title:** Formal Definitions & Governing Laws
- **Visual Asset:** Mathematical formulation box with callouts for key variables.
- **Key Bullet Points:**
  - Formal definition of ${topic}.
  - Crucial role of **${info.keywords[0]}**.
  - Boundary invariants that must always hold true.
- **Faculty Speaker Notes:** *"Emphasize the formal definition. Students often drop marks on definitions during external exams."*

##### Slide 4: System Architecture & Workflow Diagram
- **Slide Title:** The Structural Architecture of ${topic}
- **Visual Asset:** Clean 4-step flowchart showing input → transformation → validation → output.
- **Key Bullet Points:**
  - Component deconstruction: ${info.keyTerminology[0]}, ${info.keyTerminology[1]}.
  - Control flow and data dependency path.
- **Faculty Speaker Notes:** *"Point to the decision diamond in the flowchart. This is where 90% of students make logic errors."*

##### Slide 5: Deep Dive: Core Mechanics & Algorithmic Steps
- **Slide Title:** Execution Mechanics Step-by-Step
- **Visual Asset:** Monospace pseudo-code snippet with highlighted execution pointer.
- **Key Bullet Points:**
  - Step 1: Pre-condition verification.
  - Step 2: State transition execution (${info.keywords[2] ?? "main routine"}).
  - Step 3: Post-condition validation.
- **Faculty Speaker Notes:** *"Trace each line carefully. Have students predict the variable values at line 4."*

##### Slide 6: Concrete Worked Example
- **Slide Title:** Case Walkthrough: Step-by-Step Problem Solving
- **Visual Asset:** Split screen: problem statement on left, animated solution steps on right.
- **Key Bullet Points:**
  - Scenario: ${info.sampleExample}
  - Tracking variable states across each iteration.
  - Final verified solution and proof of correctness.
- **Faculty Speaker Notes:** *"Pause here for 3 minutes. Ask students to compute the next step in their notebooks before advancing."*

##### Slide 7: Complexity, Performance & Trade-offs
- **Slide Title:** Performance Analysis & Resource Bounds
- **Visual Asset:** Asymptotic complexity graph (Time vs Space trade-off curve).
- **Key Bullet Points:**
  - Best-case, Average-case, and Worst-case bounds: **${info.keyTerminology[0]}**.
  - Auxiliary memory overhead: **${info.keyTerminology[1]}**.
  - When NOT to use ${topic} (alternative designs).
- **Faculty Speaker Notes:** *"No technique is a silver bullet. Discuss the trade-offs between memory footprint and execution speed."*

##### Slide 8: Interactive Classroom Quiz
- **Slide Title:** Quick Check: Test Your Intuition
- **Visual Asset:** 2 multiple-choice questions with QR code for live classroom poll.
- **Key Bullet Points:**
  - Question: How does ${topic} behave under empty or singleton inputs?
  - Common pitfall preview.
- **Faculty Speaker Notes:** *"Give students 60 seconds to vote. Call on a student who picked Option B to explain their reasoning."*

##### Slide 9: Industry Applications & Modern Implementations
- **Slide Title:** ${topic} in Production & Cloud Systems
- **Visual Asset:** Logos and architecture snippets of modern tech stacks utilizing this concept.
- **Key Bullet Points:**
  - How modern frameworks optimize ${topic} under the hood.
  - Interview relevance: standard technical screening questions.
- **Faculty Speaker Notes:** *"Tell students: this exact topic appears regularly in senior software engineering interviews."*

##### Slide 10: Summary, Key Takeaways & Homework
- **Slide Title:** Key Takeaways & Next Steps
- **Visual Asset:** 3 bullet recap cards with homework assignment box.
- **Key Bullet Points:**
  - Review: 3 non-negotiable rules of ${topic}.
  - Homework problem sheet available on the course portal.
  - Next class preview: Advanced extensions and related patterns.
- **Faculty Speaker Notes:** *"Wrap up on time. Remind students of the assignment deadline next week."*`;
}

function generateAssignment(topic: string, level: string, info: TopicDomainInfo): string {
  return `### 📑 Graded Assignment: ${topic}
**Course Level:** ${level} | **Maximum Marks:** 25 Marks | **Submission Window:** 7 Calendar Days

> [!IMPORTANT]
> All submissions must adhere to the institutional Academic Integrity Policy. Show all intermediate derivations, state transition tables, and complexity justifications.

---

#### 🔹 Part A: Foundational Concepts (2 × 2.5 = 5 Marks)
1. **(Bloom: Remember)** Formally define **${topic}**. State the three essential conditions or invariants required for its correct execution.
2. **(Bloom: Understand)** Differentiate between ${info.keyTerminology[0] ?? "the standard approach"} and ${info.keyTerminology[1] ?? "an unoptimized approach"}. Why is this distinction critical in resource-constrained environments?

---

#### 🔹 Part B: Analytical & Computational Problems (2 × 5 = 10 Marks)
3. **(Bloom: Apply)**
   ${info.sampleProblem}
   - *(a)* Formulate the initial mathematical model or state space. *(2 marks)*
   - *(b)* Execute the step-by-step algorithm and document all intermediate states. *(3 marks)*

4. **(Bloom: Analyze)**
   Given the following operational scenario:
   > *"${info.sampleExample}"*
   - Identify whether any performance bottlenecks or edge-case anomalies occur.
   - Formulate an optimized mitigation strategy and calculate the resulting improvement in ${info.keywords[0] ?? "runtime bounds"}.

---

#### 🔹 Part C: Design & System Synthesis Challenge (1 × 10 = 10 Marks)
5. **(Bloom: Create)**
   Design an end-to-end architecture or software module incorporating **${topic}** for a mission-critical college portal (e.g., handling 10,000 concurrent student transactions).
   - **Deliverable 1:** Structural diagram / Flowchart showing component interactions. *(3 marks)*
   - **Deliverable 2:** Modular pseudo-code implementing the core routine with robust error handling. *(4 marks)*
   - **Deliverable 3:** Formal verification proof or edge-case test suite covering at least 3 distinct boundary cases. *(3 marks)*

---

#### 📋 Submission Guidelines & Format Requirements
- **Format:** Typed PDF report or Git repository containing annotated code and documentation.
- **Deadline:** Strict 7-day cutoff. Late submissions incur a 10% penalty per day up to 48 hours.
- **Evaluation Criteria:** Accuracy of solution (40%), Rigor of analysis & edge cases (30%), Clarity of documentation (30%).`;
}

function generateRubric(topic: string, level: string, info: TopicDomainInfo): string {
  return `### 📊 Faculty Grading Rubric: ${topic}
**Target Level:** ${level} | **Assessment Type:** Assignment, Mini-Project & Exam Evaluation | **Scale:** 100 Points (Scaled to 25 or 50 Marks)

| Evaluation Dimension & Weight | Exemplary (90–100%) | Proficient (75–89%) | Developing (50–74%) | Novice (<50%) |
|---|---|---|---|---|
| **1. Theoretical Mastery & Definitions (25%)** | Flawlessly states formal definitions, invariants, and mathematical formulations of **${topic}**; demonstrates deep conceptual command. | States definitions correctly with minor omissions; understands governing principles without major conceptual errors. | Partial recall; confuses secondary terminology (${info.keyTerminology[1] ?? "terms"}) or gives imprecise qualitative explanations. | Major misconceptions; cannot define core mechanisms or states incorrect definitions. |
| **2. Problem Solving & Execution (35%)** | Correctly solves ${info.sampleProblem.slice(0, 45)}... with zero arithmetic or logical flaws; intermediate steps clearly documented. | Solves problem with correct methodology; minor arithmetic or syntax slip that does not affect core logic. | Demonstrates correct initial setup but derails during intermediate state transitions; partial completion. | Incorrect approach from the outset; unable to apply the methodology to given inputs. |
| **3. Edge-Case & Boundary Handling (20%)** | Rigorously accounts for boundary conditions (${info.keywords[1] ?? "edge cases"}), null inputs, and maximum load constraints. | Identifies standard boundary cases; minor gaps in extreme degenerate cases. | Only accounts for typical happy-path inputs; completely ignores edge cases. | No consideration of edge cases; solution crashes or produces invalid states on boundary inputs. |
| **4. Technical Documentation & Code Style (20%)** | Pristine structural formatting, clean architectural diagrams, modular pseudo-code, and concise complexity justification. | Well-structured with readable notation and standard diagrams; minor formatting inconsistencies. | Disorganized layout; missing diagrams or difficult-to-read mathematical/code notations. | Incomplete, fragmented, or plagiarized work; lacks required sections and documentation. |

---

#### 📝 Evaluator Feedback Bank (Copy-Paste Prompts for Faculty)
- **High Achiever:** *"Excellent command of ${topic}. Outstanding edge-case analysis and rigorous proof of ${info.keywords[0]}."*
- **Proficient:** *"Good solution. Make sure to clearly state your boundary condition checks in Step 2 to avoid potential runtime errors."*
- **Needs Improvement:** *"Review the foundational theory of ${topic}, particularly the difference between normal execution and ${info.keyTerminology[0]}. Schedule an office-hour review."*`;
}

function generateLabManual(topic: string, level: string, info: TopicDomainInfo): string {
  return `### 🔬 Practical Lab Manual Experiment: ${topic}
**Subject:** Advanced Engineering Laboratory | **Target Level:** ${level} | **Allotted Time:** 2 Hours (120 Minutes)

---

#### 📌 Experiment Details
- **Experiment Title:** Design, Implementation, and Empirical Validation of **${topic}**
- **Course Outcome:** CO-3 (Apply modern computational tools to design and validate software/hardware systems).

#### 🎯 Aim of the Experiment
To design, implement, and empirically verify **${topic}**, analyzing its operational behavior under varying input distributions and validating execution bounds against theoretical expectations.

#### 🛠️ Equipment & Software Prerequisites
1. **Operating Environment:** Linux / Windows 11 workstation with C++ / Python 3.10+ / Java 17+ compiler installed.
2. **Development Tool:** VS Code, CLion, or Jupyter Notebook with profiling tools enabled.
3. **Test Dataset Generator:** Script to produce random, sorted, and boundary-condition test suites.

---

#### 📐 Underlying Theory & Algorithmic Principle
**${topic}** enforces structured state transitions to guarantee operational efficiency. The experiment verifies that runtime stays within ${info.keywords[0] ?? "asymptotic bounds"}.

##### Algorithm in Pseudo-Code
\`\`\`text
ALGORITHM Execute_${topic.replace(/[^a-zA-Z0-9]/g, "_")}(InputData)
1. Initialize status ← VALID, metrics ← { comparisons: 0, memory: 0 }
2. IF InputData is NULL or Length(InputData) == 0 THEN
3.     RETURN Error_Code_Empty_Input
4. END IF
5. FOR each element IN InputData DO
6.     Apply transformation rule for ${topic}
7.     Validate state invariant: verify(${info.keyTerminology[0] ?? "invariant"})
8. END FOR
9. RETURN Verified_Output, metrics
END ALGORITHM
\`\`\`

---

#### 🧪 Step-by-Step Laboratory Procedure
1. **Pre-Lab Preparation:** Read the theoretical lecture notes on **${topic}**. Draw the flowchart in the observation record.
2. **Step 1 — Workspace Setup:** Create a new project directory \`lab_${topic.toLowerCase().replace(/[^a-z0-9]/g, "_")}\`.
3. **Step 2 — Core Implementation:** Write the modular functions implementing the algorithm described above.
4. **Step 3 — Input Data Feeding:** Run the program with standard test inputs (${info.sampleExample.slice(0, 40)}). Record outputs.
5. **Step 4 — Stress & Boundary Testing:** Execute tests with extreme edge cases (e.g. $N = 10^5$, reverse-sorted data, all duplicates).
6. **Step 5 — Tabulation & Graph Plotting:** Plot Input Size ($N$) vs Execution Time ($t$) and compare against theoretical $O(N)$ curves.

---

#### 📊 Sample Input & Expected Execution Output

##### Sample Input:
\`\`\`
Input Dataset Size: 6
Elements: [14, 3, 27, 8, 42, 19]
Mode: Strict Verification (${topic})
\`\`\`

##### Expected Program Output:
\`\`\`
[INFO] Pre-condition checks passed. Invariants verified.
[EXEC] Processing element transformations for ${topic}...
[STATE] Intermediate step 1: Validated
[STATE] Intermediate step 2: Invariants maintained
[RESULT] Output generated successfully in 0.042 ms.
[METRIC] Total Comparisons: 11 | Auxiliary Memory Allocated: 48 bytes.
Status: PASS (Matches theoretical model)
\`\`\`

---

#### 🗣️ Viva Voce Examination Questions & Model Answers

**Viva Q1:** ${info.vivaQuestion}
> **Model Answer:** ${info.vivaAnswer}

**Viva Q2:** What happens if the input violates ${info.keywords[1] ?? "precondition requirements"}?
> **Model Answer:** The program must detect the violation in $O(1)$ pre-processing time and throw a controlled domain exception rather than cascading failures.

**Viva Q3:** Name two real-world enterprise applications that rely directly on **${topic}**.
> **Model Answer:** Database query execution engines and kernel-level network packet routing schedulers.

---

#### ⚖️ Lab Assessment Matrix (Total: 20 Marks)
- **Pre-lab Preparation & Algorithm (4 Marks):** Complete observation notebook with flowcharts.
- **Program Coding & Execution (8 Marks):** Modular, clean code executing correctly on all test suites.
- **Result Analysis & Graph (4 Marks):** Accuracy of tabulated metrics and boundary verification.
- **Viva Voce Performance (4 Marks):** Prompt and accurate conceptual defense of implementation.`;
}

function generateRemedialPlan(topic: string, level: string, info: TopicDomainInfo): string {
  return `### 🎯 Remedial & Bridge Action Plan: ${topic}
**Cohort:** Students with Mastery Score < 50% in **${topic}** | **Target Level:** ${level} | **Remediation Duration:** 2 Weeks (3 Micro-Sessions)

---

#### 🔍 Diagnostic Root-Cause Analysis
Based on continuous formative assessments, students struggling with **${topic}** typically exhibit difficulties in three distinct areas:
1. **Prerequisite Gaps:** Weak foundation in basic ${info.keywords[1] ?? "mathematical concepts"} and notation.
2. **Abstract Visualization:** Inability to mentally trace ${info.keywords[2] ?? "state transitions"} without physical diagrams.
3. **Panic on Edge Cases:** Skipping validation and guessing answers on non-standard problem formulations.

---

#### 📅 3-Stage Scaffolded Remediation Framework

##### 🔹 Stage 1: Prerequisite Bridge & Visual Deconstruction (Day 1–3 · 30 Min)
- **Objective:** Demystify the jargon. Connect **${topic}** to simple, everyday intuitive analogies.
- **Activity:** Use interactive physical models or step-by-step visual flashcards.
- **Faculty Lead Action:** Walk through ${info.sampleExample.slice(0, 50)} without complex formulas. Focus entirely on *why* the rules exist.
- **Student Milestone:** Complete a 3-question visual identification worksheet with 100% accuracy.

##### 🔹 Stage 2: Scaffolded "I Do, We Do, You Do" Drill (Day 4–8 · 45 Min)
- **I Do (Faculty Demonstration):** Faculty solves a full problem on the board, thinking aloud through every decision branch.
- **We Do (Guided Peer Practice):** Faculty and students solve a parity problem together. Students call out the next step.
- **You Do (Independent Challenge):** Students individually solve:
  > *"${info.sampleProblem}"*
  Assisted by a 1-page "Cheat-Sheet" checklist.

##### 🔹 Stage 3: Mastery Verification & Confidence Restoral (Day 9–14 · 30 Min)
- **Targeted Re-Assessment:** Administer a 5-question micro-quiz covering core concepts only.
- **Benchmark:** Student must achieve $\\ge 70\\%$ to exit the remedial tracking list.
- **Post-Remediation Support:** Assign an peer mentor from the high-mastery cohort for ongoing study group check-ins.

---

#### 📋 Student Self-Checklist Before Retest
- [ ] Can I define ${topic} in my own words without memorizing?
- [ ] Can I identify the 2 most common pitfalls (${info.keyTerminology[2] ?? "common errors"})?
- [ ] Can I trace a 5-step worked example from start to finish?
- [ ] Do I know what formula or invariant to write down first?`;
}

/**
 * Builds dynamic blueprint-aligned university question papers adapted to any course, units, marks, and pattern.
 */
export async function generateQuestionPaperContent(
  courseRaw: string,
  unitsRaw: string,
  marksRaw: string,
  patternRaw: string,
): Promise<string> {
  const course = (courseRaw || "CS3492 Database Management Systems").trim();
  const units = (unitsRaw || "Units 1–5").trim();
  const marks = parseInt(marksRaw, 10) || 50;
  const pattern = (patternRaw || "Part A (2 marks) + Part B (13 marks)").trim();

  const info = analyzeTopic(course);

  if (pattern.includes("MCQ")) {
    const qCount = Math.min(Math.max(Math.floor(marks / 2), 10), 30);
    return `### 📑 Question Paper: ${course}
**Syllabus Coverage:** ${units} | **Maximum Marks:** ${marks} Marks | **Exam Mode:** Objective (Multiple Choice)
**Duration:** 90 Minutes | **All questions carry equal marks (no negative marking).**

---

#### 🔘 Section: Multiple Choice Questions (${qCount} × ${marks / qCount} = ${marks} Marks)

1. Which of the following best defines the primary architectural principle of **${course}**? (CO1, Remember)
   - (A) Unconstrained dynamic allocation without invariant checks
   - (B) Formal state integrity, correctness guarantees, and deterministic bounds
   - (C) Bypassing hardware interrupts during synchronous execution
   - (D) Indefinite buffering of unvalidated input packets

2. In the context of **${info.keywords[0]}**, what is the primary consequence of a boundary violation? (CO2, Understand)
   - (A) Automatic runtime self-healing without log generation
   - (B) State corruption or non-terminating asymptotic degradation
   - (C) Doubling of CPU register width
   - (D) Conversion of asynchronous tasks into atomic transactions

3. Consider an implementation of **${info.keyTerminology[0]}**. What is the worst-case operational bound? (CO3, Apply)
   - (A) Bounded by $O(N \\log N)$ under standard operating constraints
   - (B) Guaranteed strictly constant $O(1)$ under all degenerate inputs
   - (C) Unbounded exponential growth
   - (D) Bounded strictly by hardware cache line count

4. When evaluating **${info.keywords[1]}**, which defensive programming technique is recommended? (CO4, Analyze)
   - (A) Suppress all boundary warnings
   - (B) Validate pre-conditions and guard invariants prior to state transition
   - (C) Force immediate thread termination
   - (D) Disable memory virtualization

5. Which design trade-off is unavoidable when scaling **${course}** across high-throughput enterprise systems? (CO5, Evaluate)
   - (A) Accuracy vs. Storage footprint
   - (B) Throughput vs. Latency and consistency guarantees
   - (C) Hardware bus width vs. Network socket count
   - (D) Compiler optimization vs. Source code indentation

---

#### 📊 Blueprint & Outcome Attainment Matrix
- **Course Outcomes:** CO1: 20% | CO2: 25% | CO3: 25% | CO4: 20% | CO5: 10%
- **Cognitive Levels:** Remember: 20% | Understand: 30% | Apply: 30% | Analyze: 20%`;
  }

  // Descriptive / Part A + Part B
  const partAMarks = marks >= 100 ? 20 : marks >= 50 ? 10 : 8;
  const partBMarks = marks - partAMarks;
  const partAQCount = partAMarks / 2;

  return `### 📑 University Examination: ${course}
**Syllabus Coverage:** ${units} | **Maximum Marks:** ${marks} Marks | **Duration:** 3 Hours
**Approved Blueprint Regulations 2026**

---

#### 📝 Part A (${partAQCount} × 2 = ${partAMarks} Marks)
*Answer ALL questions. Each question carries 2 marks.*

1. State the fundamental governing principle or objective of **${course}**. *(CO1, Remember)*
2. Define **${info.keyTerminology[0] ?? "core invariant"}** and state its significance. *(CO1, Remember)*
3. Why is **${info.keywords[0] ?? "efficiency analysis"}** critical in large-scale system deployments? *(CO2, Understand)*
4. Differentiate between **${info.keyTerminology[1] ?? "standard execution"}** and **${info.keyTerminology[2] ?? "unbounded execution"}**. *(CO3, Understand)*
5. State the necessary pre-conditions required before triggering **${info.keywords[1] ?? "state transitions"}**. *(CO2, Remember)*

---

#### 📝 Part B (${partBMarks} Marks)
*Answer either (a) or (b) from each question. Detailed steps and schematics required.*

**Q6. (13 Marks)**
- **(a)** Formulate the formal theoretical framework for **${course}**. Provide a complete step-by-step mathematical or architectural derivation demonstrating how ${info.keywords[0]} is achieved. *(CO2, Apply)*
  **— OR —**
- **(b)** Deconstruct the following problem statement:
  > *"${info.sampleProblem}"*
  Execute the complete solution and verify correctness across boundary states. *(CO3, Apply)*

**Q7. (13 Marks)**
- **(a)** Conduct a comprehensive critical analysis of:
  > *"${info.sampleExample}"*
  Identify potential failure modes, compute resource bounds, and recommend an optimized mitigation architecture. *(CO4, Analyze)*
  **— OR —**
- **(b)** Explain the architectural mechanisms that govern **${info.keywords[2] ?? "system operations"}**. Draw a clear system schematic and trace control flow during peak concurrency. *(CO4, Analyze)*

**Q8. (${partBMarks - 26 > 0 ? partBMarks - 26 : 14} Marks)**
- **(a)** Design a modular, production-ready system architecture for a campus enterprise that incorporates **${course}**. Include component diagrams, interface specifications, and edge-case validation suites. *(CO5, Create)*
  **— OR —**
- **(b)** Defend the engineering trade-offs between execution speed, memory footprint, and fault tolerance in **${course}**. Support your defense with empirical benchmark models. *(CO5, Evaluate)*

---

#### 📊 Blueprint & Bloom Attainment Matrix
- **CO Coverage:** CO1 (Remember): 16% · CO2 (Understand): 24% · CO3 (Apply): 26% · CO4 (Analyze): 20% · CO5 (Create/Evaluate): 14%
- **Rigor Level:** Aligned with NBA / ABET Criterion 3 accreditation standards.`;
}

