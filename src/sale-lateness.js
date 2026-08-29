/* Shared by the sale skin and its Node regression fixture. */
(function (global) {
  'use strict';

  function handlerDelayMs(eventTimeStamp, handlerAt) {
    let pressedAt = Number(eventTimeStamp);
    if (!Number.isFinite(pressedAt) || pressedAt <= 0 || pressedAt > handlerAt) pressedAt = handlerAt;
    return Math.max(0, handlerAt - pressedAt);
  }

  function isLate(eventTimeStamp, handlerAt, ceilingMs) {
    return handlerDelayMs(eventTimeStamp, handlerAt) > ceilingMs;
  }

  global.SaleLateness = Object.freeze({ handlerDelayMs, isLate });
})(window);
