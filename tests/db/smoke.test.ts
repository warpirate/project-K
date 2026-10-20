import { it, expect } from "vitest";
import { newUserClient } from "../helpers";

it("creates and signs in a user against Supabase", async () => {
  const { client, userId } = await newUserClient();
  const { data } = await client.auth.getUser();
  expect(data.user?.id).toBe(userId);
});
