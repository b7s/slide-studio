import { describe, it, expect, vi } from "vitest";
import { createSlideEditor } from "../editor/slideEditor";

// The editor engine operates on a DOM root. jsdom provides enough of the DOM
// API (querySelector/closest/insertBefore/getComputedStyle) to exercise the
// table mutation commands without a real shadow root or browser.
function mount(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

const TABLE = `
  <table>
    <tr><td>A1</td><td>A2</td></tr>
    <tr><td>B1</td><td>B2</td></tr>
  </table>
`;

function cellAt(root, row, col) {
  return root.querySelectorAll("tr")[row].querySelectorAll("td, th")[col];
}

describe("slideEditor table operations", () => {
  it("detects a selected table cell and reports its coordinates", async () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    const info = onSelection.mock.calls.at(-1)[0];

    expect(info.table.isCell).toBe(true);
    expect(info.table.rowIndex).toBe(0);
    expect(info.table.colIndex).toBe(0);
    expect(info.table.rowCount).toBe(2);
    expect(info.table.colCount).toBe(2);

    engine.destroy();
    root.remove();
  });

  it("inserts and deletes rows", () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    engine.insertRow(true);
    expect(root.querySelectorAll("tr").length).toBe(3);
    expect(root.querySelectorAll("tr")[1].querySelectorAll("td").length).toBe(2);

    engine.deleteRow();
    expect(root.querySelectorAll("tr").length).toBe(2);

    engine.destroy();
    root.remove();
  });

  it("inserts and deletes columns", () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    engine.insertColumn(true);
    expect(root.querySelectorAll("tr")[0].querySelectorAll("td").length).toBe(3);

    engine.deleteColumn();
    expect(root.querySelectorAll("tr")[0].querySelectorAll("td").length).toBe(2);

    engine.destroy();
    root.remove();
  });

  it("moves a row down", () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    engine.moveRow(1);
    const rows = root.querySelectorAll("tr");
    expect(rows[0].textContent).toContain("B1");
    expect(rows[1].textContent).toContain("A1");

    engine.destroy();
    root.remove();
  });

  it("moves a column right", () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    engine.moveColumn(1);
    const firstRow = root.querySelector("tr").children;
    expect(firstRow[0].textContent).toContain("A2");
    expect(firstRow[1].textContent).toContain("A1");

    engine.destroy();
    root.remove();
  });

  it("sets row height and column width", () => {
    const root = mount(TABLE);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    cellAt(root, 0, 0).click();
    engine.setRowHeight(40);
    engine.setColumnWidth(120);

    expect(root.querySelectorAll("tr")[0].style.height).toBe("40px");
    expect(root.querySelector("td").style.width).toBe("120px");

    engine.destroy();
    root.remove();
  });

  it("refuses to delete the last row or column", () => {
    const root = mount(`<table><tr><td>only</td></tr></table>`);
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onSelection, onChange: vi.fn() });

    root.querySelector("td").click();
    engine.deleteRow();
    engine.deleteColumn();

    expect(root.querySelectorAll("tr").length).toBe(1);
    expect(root.querySelectorAll("td").length).toBe(1);

    engine.destroy();
    root.remove();
  });
});
