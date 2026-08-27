export interface ApiResponse {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  data: unknown;
}

export async function testApiRequest(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" = "GET",
  headers: Record<string, string> = {},
  body?: string | Record<string, unknown>,
  timeoutMs: number = 10000
): Promise<ApiResponse> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formattedHeaders: Record<string, string> = { ...headers };
    let requestBody: string | undefined;

    if (body) {
      if (typeof body === "object") {
        requestBody = JSON.stringify(body);
        if (!formattedHeaders["Content-Type"]) {
          formattedHeaders["Content-Type"] = "application/json";
        }
      } else {
        requestBody = String(body);
      }
    }

    const response = await fetch(url, {
      method,
      headers: formattedHeaders,
      body: ["GET", "HEAD"].includes(method.toUpperCase()) ? undefined : requestBody,
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;
    clearTimeout(timeoutId);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      headers: responseHeaders,
      data,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    throw new Error(`API Request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function generateMockData(
  type: "users" | "products" | "posts" | "transactions" = "users",
  count: number = 5
): Array<Record<string, unknown>> {
  const safeCount = Math.min(Math.max(1, count), 50);
  const items: Array<Record<string, unknown>> = [];

  const FIRST_NAMES = ["Alex", "Elena", "Liam", "Sophia", "Noah", "Maya", "Ethan", "Zara", "Lucas", "Aria"];
  const LAST_NAMES = ["Vance", "Mercer", "Sterling", "Kovacs", "Chen", "Patel", "Silva", "Novak", "O'Connor", "Rahman"];
  const ROLES = ["Admin", "Member", "Moderator", "Guest", "Contributor"];
  const CITIES = ["San Francisco", "London", "Tokyo", "Colombo", "Singapore", "Berlin", "Toronto", "Sydney"];
  const TECH_STACKS = ["TypeScript", "Next.js", "Python", "Rust", "Go", "Docker", "PostgreSQL", "TailwindCSS"];

  for (let i = 1; i <= safeCount; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;

    if (type === "users") {
      items.push({
        id: `usr_${Math.random().toString(36).substring(2, 9)}`,
        name: `${fn} ${ln}`,
        email,
        role: ROLES[i % ROLES.length],
        city: CITIES[i % CITIES.length],
        skills: [TECH_STACKS[i % TECH_STACKS.length], TECH_STACKS[(i + 2) % TECH_STACKS.length]],
        isActive: i % 4 !== 0,
        createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      });
    } else if (type === "products") {
      items.push({
        id: `prd_${Math.random().toString(36).substring(2, 9)}`,
        title: `Pro Developer Tool v${i}.0`,
        category: i % 2 === 0 ? "Software" : "Cloud Services",
        price: parseFloat((19.99 * (i + 1)).toFixed(2)),
        stock: (i * 17) % 100,
        rating: parseFloat((4.0 + (i % 10) * 0.1).toFixed(1)),
        isFeatured: i % 3 === 0,
      });
    } else if (type === "posts") {
      items.push({
        id: `post_${Math.random().toString(36).substring(2, 9)}`,
        title: `Mastering ${TECH_STACKS[i % TECH_STACKS.length]} in 2026: Part ${i}`,
        author: `${fn} ${ln}`,
        views: i * 342,
        likes: i * 28,
        tags: [TECH_STACKS[i % TECH_STACKS.length].toLowerCase(), "development", "ai"],
        publishedAt: new Date(Date.now() - i * 3600000 * 12).toISOString(),
      });
    } else {
      items.push({
        id: `tx_${Math.random().toString(36).substring(2, 11)}`,
        sender: `${fn} ${ln}`,
        amount: parseFloat((45.5 * i).toFixed(2)),
        currency: "USD",
        status: i % 5 === 0 ? "FAILED" : "COMPLETED",
        timestamp: new Date(Date.now() - i * 600000).toISOString(),
      });
    }
  }

  return items;
}
