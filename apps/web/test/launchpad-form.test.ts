import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultLaunchForm, suggestTicker } from "../lib/launchpad-form.ts";

test("tickers are short initials of the meaningful title words", () => {
  assert.equal(suggestTicker("Smart Water Bottle"), "SWB");
  assert.equal(suggestTicker("1L Aluminum Smart Water Bottle with Temperature and Clock Display"), "ASWBTC");
  assert.equal(suggestTicker("Plant monitor"), "PLANT");
  assert.equal(suggestTicker("!!!"), "COIN");
});

test("the form starts from the design with optional links empty", () => {
  const form = defaultLaunchForm("  A".padEnd(60, "x"), "Measures water.", "https://bluebuild.example/project/abc");

  assert.equal(form.name.length, 32);
  assert.equal(form.description, "Measures water.");
  assert.equal(form.website, "https://bluebuild.example/project/abc");
  assert.equal(form.twitter, "");
  assert.equal(form.telegram, "");
  assert.equal(form.initialBuySol, "0");
});
