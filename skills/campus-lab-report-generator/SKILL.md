---
name: campus-lab-report-generator
description: Activate when a university student needs to write, format, or structure an academic lab practical report, experiment write-up, or coursework assignment for computer science, software engineering, or data structures courses — trigger phrasings include "write a lab report for this practical", "format my experiment results into an IEEE report", "help me structure my lab submission", "write the methodology and results for my data structures lab", "generate a 2-column lab report", or "review my coursework lab report draft". Produces IEEE-formatted two-column markdown/LaTeX templates with structured objectives, apparatus, methodology, algorithmic analysis, terminal output captures, error discussions, and formal references.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [lab-report, academic-writing, ieee-format, coursework, experiment-writeup, data-structures, university-practical]
---

# Campus Lab Report Generator Runbook

## Mission

Transform raw code, terminal traces, and rough experiment notes into a rigorous, professional IEEE-compliant university laboratory report. Academic evaluators and lab instructors penalize submissions for missing error discussions, unexplained Big-O scaling, sloppy code formatting, and non-reproducible test setups. This skill enforces strict academic rigor, ensuring every report articulates *what was measured*, *why the algorithmic behavior occurred*, and *how theoretical expectations matched empirical results*.

---

## Mental Model & Evaluation Rubrics

### Academic Lab Evaluation Breakdown (Standard 100-Point Model)

```
┌────────────────────────────────────────────────────────────────────────┐
│               Academic Lab Report Grading Rubric (100 pts)             │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ Section              │ Weight               │ Primary Grading Criteria │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 1. Objective & Setup │ 10 pts               │ Scope, clarity, versions │
│ 2. Methodology & Code│ 30 pts               │ Code quality, comments   │
│ 3. Results & Plots   │ 30 pts               │ Empirical verification   │
│ 4. Error Analysis    │ 20 pts               │ Theoretical vs actual    │
│ 5. Conclusion & Refs │ 10 pts               │ IEEE citation format     │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

### The Theory-to-Empirical Verification Loop

A laboratory report is not just a summary of what you coded; it is an empirical validation of computer science theory:

```
    ┌──────────────────────┐         ┌─────────────────────────┐
    │ Theoretical Model    │         │ Empirical Experiment    │
    │ (e.g. O(N log N)     │         │ (Wall-clock benchmarks, │
    │  QuickSort analysis) │         │  sample sizes N=10..10k)│
    └──────────┬───────────┘         └───────────┬─────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                ▼
                   ┌────────────────────────┐
                   │  Discussion & Delta    │
                   │  (Cache misses, JVM    │
                   │   warmup, GC pauses)   │
                   └────────────────────────┘
```

---

## Step-by-Step Execution Protocol

### Phase 1: Lab Context & Data Extraction

Before generating the report, extract the required experiment metadata:

1. **Academic Metadata**:
   - Course Name & Code (e.g., `CS2030: Data Structures & Algorithms`).
   - Student Name, Student Registration ID, Group/Lab Batch.
   - Date of Experimentation, Lab Title & Practical Sheet Number.
2. **Experiment Parameters**:
   - Operating System, CPU architecture, RAM, Compiler/Runtime version (e.g., `GCC 14.2.0`, `Node.js v22.13.0`, `Python 3.12.3`).
   - Input dataset characteristics (e.g., Uniform random, reverse-sorted, sparse matrices, worst-case permutations).
3. **Execution Metrics**:
   - Recorded runtimes (milliseconds/microseconds), memory peak RSS, cache hit ratios, or testcase pass rates.

---

### Phase 2: Report Generation (IEEE 2-Column Template)

Generate the complete report following the structured IEEE format:

```markdown
# [Lab Title]: Implementation and Performance Analysis of [Algorithm/System]

**Author:** [Student Name]  
**Registration ID:** [Student ID]  
**Department:** Department of Computer Science & Software Engineering  
**Institution:** Sri Lanka Institute of Information Technology (SLIIT)  
**Course Code:** [Course Code] — [Course Title]  
**Date:** [Date of Submission]

---

## Abstract
This laboratory investigation evaluates the implementation, correctness, and empirical runtime scaling of [Algorithm/System Name]. The core algorithms were implemented in [Language/Environment] and evaluated across varied input dataset distributions ranging from $N = 10^2$ to $N = 10^6$. Empirical benchmarks confirm an asymptotic time complexity of $\mathcal{O}(N \log N)$ under randomized configurations, validating theoretical expectations against standard benchmarks.

---

## I. Objectives
1. To design and implement [Core Feature/Algorithm] adhering to strict modular software design principles.
2. To empirically measure wall-clock execution time and auxiliary space consumption across varying input scales.
3. To compare experimental performance metrics against theoretical asymptotic upper bounds ($\mathcal{O}$-notation).

---

## II. Apparatus & Experimental Environment
- **Hardware Platform:** Apple M2 Pro / x86_64, 16 GB Unified Memory.
- **Operating Environment:** macOS Sequoia 15.3 / Ubuntu 24.04 LTS.
- **Toolchain & Compilers:** `g++ -O3 -std=c++20` / `Node.js v22.13.0` / `Python 3.12.3`.
- **Benchmarking Tools:** `std::chrono::high_resolution_clock`, `perf stat`, `mcs algo_stress_test`.

---

## III. Algorithmic Methodology & Implementation

### A. Mathematical Formulation
Let $A$ represent an input array of length $N$. The divide-and-conquer recurrence relation is governed by:
$$T(N) = 2T\left(\frac{N}{2}\right) + \mathcal{O}(N)$$
By applying the Master Theorem (Case 2), the asymptotic bound evaluates to $\Theta(N \log N)$.

### B. Core Implementation Snippet
```cpp
// Partition subroutine with randomized pivot selection
int randomizedPartition(std::vector<int>& arr, int low, int high) {
    int randomPivot = low + rand() % (high - low + 1);
    std::swap(arr[randomPivot], arr[high]);
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; ++j) {
        if (arr[j] <= pivot) {
            ++i;
            std::swap(arr[i], arr[j]);
        }
    }
    std::swap(arr[i + 1], arr[high]);
    return i + 1;
}
```

---

## IV. Empirical Results & Performance Evaluation

### A. Benchmarking Data Table
| Input Size ($N$) | Best Case (ms) | Average Case (ms) | Worst Case (ms) | Memory Peak (KB) |
| :--- | :--- | :--- | :--- | :--- |
| $1,000$ | 0.12 | 0.18 | 0.45 | 128 |
| $10,000$ | 1.45 | 1.82 | 4.10 | 256 |
| $100,000$ | 16.20 | 19.45 | 48.90 | 1,024 |
| $1,000,000$ | 185.10 | 215.30 | 540.20 | 8,192 |

### B. Terminal Execution Trace
```console
$ ./benchmark_runner --dataset=uniform_random --iterations=50
[INFO] Benchmarking QuickSort vs MergeSort (N = 100,000)
>> Iteration 1-50 completed.
>> QuickSort Mean Runtime: 19.45 ms (+/- 0.32 ms)
>> Assertion Status: 100% Sorted Output Verified.
```

---

## V. Discussion & Error Analysis

1. **Discrepancies Between Theoretical and Observed Bounds**:
   - At lower constraints ($N < 500$), fixed overheads such as stack frame allocation and cache warmup dominate execution times, causing non-linear scaling deviations.
   - For sorted and reverse-sorted arrays, median-of-three pivot selection effectively mitigated the degenerate $\mathcal{O}(N^2)$ quadratic degradation.
2. **Memory Footprint Analysis**:
   - The auxiliary memory footprint remained bounded by recursion depth $\mathcal{O}(\log N)$, verifying minimal heap allocation during active execution.

---

## VI. Conclusion
The experimental results demonstrate that the implemented randomized partitioning algorithm operates in $\mathcal{O}(N \log N)$ expected time, exhibiting robust performance even on degenerate input distributions. All automated test vectors passed with zero memory leaks verified via Valgrind.

---

## References
[1] T. H. Cormen, C. E. Leiserson, R. L. Rivest, and C. Stein, *Introduction to Algorithms*, 4th ed. Cambridge, MA, USA: MIT Press, 2022, pp. 170-190.  
[2] IEEE Computer Society, "IEEE Standard for Software Quality Assurance Processes," *IEEE Std 730-2014*, pp. 1-138, 2014.
```

---

## Verification & Pre-Submission Quality Gate

Before finalizing the report, evaluate against this quality checklist:

- [ ] **Author Header Complete**: Student Name, Registration Number, Module Code, and Date verified.
- [ ] **LaTeX / Mathematical Formulations Tested**: Recurrence relations and Big-O notations syntactically valid.
- [ ] **Reproducible Toolchain**: Exact compiler flags (`-O3`, `-Wall`), node/python versions specified.
- [ ] **Empirical Data Validated**: Benchmark table includes input dimensions, runtimes, and memory consumption.
- [ ] **Discrepancy Discussion Present**: Explains why real-world execution differs slightly from pure mathematical theory.
- [ ] **IEEE Citations Complete**: References formatted with author names, publication titles, and years.
