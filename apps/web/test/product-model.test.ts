import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveProductModel } from "../lib/product-model.ts";

const bottleModel = {
  parts: [
    {
      label: "Bottle body",
      shape: "cylinder",
      size_mm: { x_mm: 75, y_mm: 75, z_mm: 250 },
      position_mm: { x_mm: 0, y_mm: 0, z_mm: 125 },
      color_hex: "#c0c6cf",
      finish: "metal",
      is_casing: true,
    },
    {
      label: "Battery",
      shape: "cylinder",
      size_mm: { x_mm: 18, y_mm: 18, z_mm: 65 },
      position_mm: { x_mm: 0, y_mm: 0, z_mm: 60 },
      is_casing: false,
      ref_des: "BT1",
    },
    {
      label: "Lid display",
      shape: "box",
      size_mm: { x_mm: 30, y_mm: 15, z_mm: 2 },
      position_mm: { x_mm: 0, y_mm: 0, z_mm: 251 },
      finish: "screen",
    },
    { label: "Bogus", shape: "hexagon", size_mm: { x_mm: 1, y_mm: 1, z_mm: 1 }, position_mm: {} },
  ],
};

test("product model parts are numbered and invalid shapes are dropped", () => {
  const model = resolveProductModel(bottleModel, null);

  assert.ok(model);
  assert.equal(model.source, "product_model");
  assert.deepEqual(model.parts.map((part) => [part.number, part.label]), [
    [1, "Bottle body"],
    [2, "Battery"],
    [3, "Lid display"],
  ]);
  assert.equal(model.parts[1].refDes, "BT1");
  assert.equal(model.parts[1].color, "#9aa4b2");
});

test("parts inside the casing are internal while surface parts stay visible", () => {
  const model = resolveProductModel(bottleModel, null);

  assert.ok(model);
  assert.equal(model.parts[0].isInternal, false);
  assert.equal(model.parts[1].isInternal, true);
  assert.equal(model.parts[2].isInternal, false);
  assert.deepEqual(model.extent, [75, 75, 252]);
});

test("designs without a product model fall back to mechanical placements", () => {
  const model = resolveProductModel(
    null,
    {
      physical_form: "Cylindrical bottle",
      render_dimensions: { x_mm: 80, y_mm: 80, z_mm: 260 },
      component_placements: [
        { ref_des: "U1", label: "Controller", position: { x_mm: 0, y_mm: 0, z_mm: -50 }, size: { x_mm: 30, y_mm: 20, z_mm: 4 } },
        { ref_des: "ENC", label: "Enclosure shell", category: "Enclosure", position: { x_mm: 0, y_mm: 0, z_mm: 0 }, size: { x_mm: 80, y_mm: 80, z_mm: 260 } },
      ],
    },
    [{ ref_des: "U1", category: "Microcontroller", name: "ESP32" }],
  );

  assert.ok(model);
  assert.equal(model.source, "mechanical");
  assert.deepEqual(model.parts.map((part) => [part.label, part.shape, part.isCasing]), [
    ["Body", "cylinder", true],
    ["Controller", "box", false],
  ]);
  assert.deepEqual(model.parts[1].position, [0, 0, 80]);
  assert.equal(model.parts[1].finish, "pcb");
  assert.equal(model.parts[1].isInternal, true);
});

test("no model is produced without any shape data", () => {
  assert.equal(resolveProductModel(null, { physical_form: "Box" }), null);
  assert.equal(resolveProductModel({ parts: [] }, null), null);
});
