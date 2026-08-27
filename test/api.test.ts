import { describe, it, expect } from "vitest";
import { generateMockData } from "../src/tools/api.js";

describe("API Suite", () => {
  it("generates synthetic user mock records", () => {
    const users = generateMockData("users", 3);
    expect(users.length).toBe(3);
    expect(users[0]).toHaveProperty("id");
    expect(users[0]).toHaveProperty("name");
    expect(users[0]).toHaveProperty("email");
  });

  it("generates synthetic products mock records", () => {
    const products = generateMockData("products", 2);
    expect(products.length).toBe(2);
    expect(products[0]).toHaveProperty("price");
    expect(products[0]).toHaveProperty("title");
  });
});
