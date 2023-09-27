/**
* (c) 2023 Taemporus
*/
(function() {
	'use strict';
	var performance = window.performance;
	var TouchDetector = {
		isTouch: false,
		lastMouseMoveTime: 0
	};
	function onTouchStart() {
		if (TouchDetector.isTouch) {
			return;
		}
		TouchDetector.isTouch = true;
		if (performance) {
			document.addEventListener('mousemove', onMouseMove, true);
		}
	}
	function onMouseMove() {
		var now = performance.now();
		if (now - TouchDetector.lastMouseMoveTime < 20) {
			TouchDetector.isTouch = false;
			document.removeEventListener('mousemove', onMouseMove, true);
		}
		TouchDetector.lastMouseMoveTime = now;
	}
	document.addEventListener('touchstart', onTouchStart, true);
	window.TouchDetector = TouchDetector;
})();
