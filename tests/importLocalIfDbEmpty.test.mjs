import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importLocalIfDbEmpty } from "../src/features/admin/hooks/importLocalIfDbEmpty.js";

describe("importLocalIfDbEmpty", () => {
  it("non importa se DB ha già righe", async () => {
    const imported = [];
    const { imported: n } = await importLocalIfDbEmpty({
      localItems: [{ id: "1" }],
      dbItems: [{ id: "x" }],
      importItem: async (row) => {
        imported.push(row);
      },
    });
    assert.equal(n, 0);
    assert.equal(imported.length, 0);
  });

  it("importa se local ha dati e DB è vuoto", async () => {
    const imported = [];
    let cleared = false;
    const { imported: n } = await importLocalIfDbEmpty({
      localItems: [{ a: 1 }, { a: 2 }],
      dbItems: [],
      importItem: async (row) => {
        imported.push(row);
      },
      onClearedLocal: () => {
        cleared = true;
      },
    });
    assert.equal(n, 2);
    assert.equal(imported.length, 2);
    assert.equal(cleared, true);
  });
});
