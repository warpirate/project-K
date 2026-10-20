import { describe, it, expect } from "vitest";
import { usernameToEmail, loginIdToEmail, isValidUsername } from "@/lib/staff";

describe("staff identities", () => {
  it("maps usernames to internal emails", () => {
    expect(usernameToEmail("Ravi_1")).toBe("ravi_1@staff.projectk.local");
  });
  it("login id: email passes through, username is mapped", () => {
    expect(loginIdToEmail(" Owner@Gmail.com ")).toBe("owner@gmail.com");
    expect(loginIdToEmail("ravi")).toBe("ravi@staff.projectk.local");
  });
  it("validates usernames", () => {
    expect(isValidUsername("ravi_1")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
  });
});
