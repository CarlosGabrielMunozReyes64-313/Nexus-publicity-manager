import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());
if (!HTMLDialogElement.prototype.showModal)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
if (!HTMLDialogElement.prototype.close)
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
// ProseMirror (TipTap) mide la selección; jsdom no implementa estas medidas.
const sinRectangulos = () =>
  Object.assign([], { item: () => null }) as unknown as DOMRectList;
if (!Range.prototype.getClientRects)
  Range.prototype.getClientRects = sinRectangulos;
if (!Range.prototype.getBoundingClientRect)
  Range.prototype.getBoundingClientRect = () => new DOMRect();
if (!document.elementFromPoint) document.elementFromPoint = () => null;
