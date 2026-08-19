import '@testing-library/jest-dom/vitest';

// jsdom implements no pointer capture, which the slider relies on to keep a
// drag bound to the slab it started on.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {};
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}
