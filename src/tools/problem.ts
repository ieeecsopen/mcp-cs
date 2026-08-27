export interface ContestProblem {
  platform: string;
  contestId: string;
  index: string;
  title: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  tags: string[];
  url: string;
}

export async function fetchCodeforcesProblem(contestId: string, index: string): Promise<ContestProblem> {
  const cleanIndex = index.toUpperCase();
  const url = `https://codeforces.com/api/problemset.problems`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      comment?: string;
      result?: { problems: Array<{ contestId: number; index: string; name: string; tags?: string[] }> };
    };

    if (data.status !== "OK" || !data.result) {
      throw new Error(`Codeforces API returned error status: ${data.comment || "Unknown"}`);
    }

    const problem = data.result.problems.find(
      (p) => String(p.contestId) === String(contestId) && p.index === cleanIndex
    );

    if (!problem) {
      throw new Error(`Problem ${contestId}${cleanIndex} not found on Codeforces.`);
    }

    return {
      platform: "Codeforces",
      contestId: String(contestId),
      index: cleanIndex,
      title: problem.name,
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      tags: problem.tags || [],
      url: `https://codeforces.com/contest/${contestId}/problem/${cleanIndex}`,
    };
  } catch (err: unknown) {
    throw new Error(`Failed to fetch problem from Codeforces: ${err instanceof Error ? err.message : String(err)}`);
  }
}
