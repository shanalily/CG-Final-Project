var canvas;
var gl;
var program;
var vBuffer;

var points = [];
var originalPoints = [];

var texCoordsArray = [];
var texture;
// will change later
var texCoord = [
	vec2(0,0),
	vec2(0,1),
	vec2(1,1),
	vec2(1,0)
];

var colors = [];
var vertexColors = [
	[ 1.0, 0.0, 0.0, 1.0 ],  // red
	[ 1.0, 1.0, 0.0, 1.0 ],  // yellow
	[ 0.0, 0.8, 0.0, 1.0 ],  // green
	[ 0.0, 0.0, 1.0, 1.0 ],  // blue
	[ 1.0, 0.5, 0.0, 1.0 ],  // orange
	[ 1.0, 1.0, 1.0, 1.0 ],  // white
];

var currentCubeLocs = [
	0,   36,  72,
	108, 144, 180,
	216, 252, 288,
	324, 360, 396,
	432, 468, 504,
	540, 576, 612,
	648, 684, 720,
	756, 792, 828,
	864, 900, 936
];
var originalCubeLocs = [];

var theta = [0, 0, 0];
var thetaLoc;
var currentAngle = [
	0, 0, 0,
	0, 0, 0,
	0, 0, 0
];

var rotationQuaternion;
var rotationQuaternionLoc;
var mouseAngle = 0.0;
var mouseAxis = [0, 0, 1];
var trackingMouse = false;
var trackballMove = false;
var mouseLastPos = [0, 0, 0];
var curx, cury;
var startX, startY;

function multq(a, b) {
	var s = vec3(a[1], a[2], a[3]);
	var t = vec3(b[1], b[2], b[3]);
	// console.log(s, t);
	return (vec4(a[0]*b[0] - dot(s,t), add(cross(t, s), add(scale(a[0],t), scale(b[0],s)))));
}

function trackballView(x, y) {
	var d, a;
	var v = [];
	v[0] = x;
	v[1] = y;
	d = v[0]*v[0] + v[1]*v[1];
	if (d < 1.0) {
		v[2] = Math.sqrt(1.0 - d);
	} else {
		v[2] = 0.0;
		a = 1.0 / Math.sqrt(d);
		v[0] *= a;
		v[1] *= a;
	}
	return v;
}

function mouseMotion(x, y) {
	var dx, dy, dz;
	var curPos = trackballView(x, y);
	if (trackingMouse) {
		dx = curPos[0] - mouseLastPos[0];
		dy = curPos[1] - mouseLastPos[1];
		dz = curPos[2] - mouseLastPos[2];
	}
	if (dx || dy || dz) {
		mouseAngle = -0.1 * Math.sqrt(dx*dx + dy*dy + dz*dz);
		mouseAxis[0] = mouseLastPos[1]*curPos[2] - mouseLastPos[2]*curPos[1];
		mouseAxis[1] = mouseLastPos[2]*curPos[0] - mouseLastPos[0]*curPos[2];
		mouseAxis[2] = mouseLastPos[0]*curPos[1] - mouseLastPos[1]*curPos[0];
		mouseLastPos[0] = curPos[0];
		mouseLastPos[1] = curPos[1];
		mouseLastPos[2] = curPos[2];
	}
	render();
}

function startMotion(x, y) {
	trackingMouse = true;
	startX = x;
	startY = y;
	curx = x;
	cury = y;
	mouseLastPos = trackballView(x, y);
	trackballMove = true;
}

function stopMotion(x, y) {
	trackingMouse = false;
	if (!(startX != x || startY != y)) {
		mouseAngle = 0.0;
		trackballMove = false;
	}
}

// puts cube back in original position, since sometimes spinning gets out of hand
function center() {
	trackingMouse = true;
	trackballMove = true;
	// I think I should reset everything to how it was at the beginning
	// but do I also need to rotate it back? find the angle to do that?
	mouseAngle = 0.0;
	mouseAxis[0] = 0; mouseAxis[1] = 0; mouseAxis[2] = 1;
	mouseLastPos[0] = 0; mouseLastPos[1] = 0; mouseLastPos[2] = 0;
	rotationQuaternion[0] = 1; rotationQuaternion[1] = 0;
	rotationQuaternion[2] = 0; rotationQuaternion[3] = 0;
	console.log("button 1");
	render();
	trackingMouse = false;
	trackballMove = false;
}

// still needs to be implemented
function isometric() {
	trackingMouse = true;
	trackballMove = true;
	//
	mouseAngle = 0.0;
	mouseAxis[0] = 0; mouseAxis[1] = 0; mouseAxis[2] = 1;
	mouseLastPos[0] = 0; mouseLastPos[1] = 0; mouseLastPos[2] = 0;
	rotationQuaternion[0] = 0.9530; rotationQuaternion[1] = -0.3029;
	rotationQuaternion[2] = 0; rotationQuaternion[3] = 0;
	// 45 degrees
	var rotation = vec4(0.9239,0,-0.3826,0);
	rotationQuaternion = multq(rotationQuaternion, rotation);
	render();
	trackingMouse = false;
	trackballMove = false;
}

function configureTexture(image) {
	texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
}

window.onload = function init() {
	canvas = document.getElementById("gl-canvas");

	gl = WebGLUtils.setupWebGL( canvas );
    if (!gl) { alert("WebGL isn't available"); }

    formCubes();

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    gl.enable(gl.DEPTH_TEST);

    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // color stuff
    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // vertex stuff
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW);

    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);

    // var goat = true;
    // if (goat) {
    // 	var imageL = document.getElementById("imageL");
    // 	configureTexture(imageL);
    // }

    rotationQuaternion = vec4(1, 0, 0, 0);
    rotationQuaternionLoc = gl.getUniformLocation(program, "r");
    gl.uniform4fv(rotationQuaternionLoc, flatten(rotationQuaternion));

    document.getElementById("center").addEventListener("click", function() {
    	center();
    });
    document.getElementById("isometric").addEventListener("click", function() {
    	isometric();
    });
    document.getElementById("reset").addEventListener("click", function() {
    	var validAnswer = false;
    	while (!validAnswer) {
    		var resetCube = prompt("Are you sure you want to reset your cube? Please answer 'Yes' or 'No'.");
	    	if (resetCube.toLowerCase() == 'yes') {
	    		reset();
	    		validAnswer = true;
	    	} else if (resetCube.toLowerCase() == 'no') {
	    		validAnswer = true;
	    	}
    	}
    	validAnswer = false; // not sure I need this
    });

    canvas.addEventListener("mousedown", function(event) {
    	var x = 2*event.clientX/canvas.width-1;
    	var y = 2*(canvas.height-event.clientY)/canvas.height-1;
    	startMotion(x, y);
    });
    canvas.addEventListener("mouseup", function(event) {
    	var x = 2*event.clientX/canvas.width-1;
    	var y = 2*(canvas.height-event.clientY)/canvas.height-1;
    	stopMotion(x, y);
    });
    canvas.addEventListener("mousemove", function(event) {
    	var x = 2*event.clientX/canvas.width-1;
    	var y = 2*(canvas.height-event.clientY)/canvas.height-1;
    	mouseMotion(x, y);
    });

    // rotations around x-axis
    document.getElementById("L").onchange = function() {
    	L(event.target.value);
    }
    document.getElementById("R").onchange = function() {
    	R(event.target.value);
    }

    // rotations around y-axis
    document.getElementById("U").onchange = function() {
    	U(event.target.value);
    }
    document.getElementById("D").onchange = function() {
    	D(event.target.value);
    }

    // rotations around z-axis
    document.getElementById("F").onchange = function() {
    	F(event.target.value);
    }
    document.getElementById("B").onchange = function() {
    	B(event.target.value);
    }

    render();
}

function formCubes() {
	currentColor = 0;
	//
	currentTexCoord = 0;
	//
    for (var i = 0; i < 216; i += 8) {
    	quad(i+1, i, i+3, i+2);
    	quad(i+2, i+3, i+7, i+6);
    	quad(i+3, i, i+4, i+7);
    	quad(i+6, i+5, i+1, i+2);
    	quad(i+4, i+5, i+6, i+7);
    	quad(i+5, i+4, i, i+1);
    }
    originalPoints = points.slice();
    originalCubeLocs = currentCubeLocs.slice();
}

function quad(a, b, c, d) {
	var indices = [a, b, c, a, c, d];
	for (var i = 0; i < indices.length; ++i) {
		points.push(vertices[indices[i]]);
		colors.push(vertexColors[currentColor]); // I might have to do the color manually
		// this needs to be fixed later
		texCoordsArray.push(texCoord[currentTexCoord]);
	}
	currentColor += 1;
	if (currentColor == 6) {
		currentColor = 0;
	}
	currentTexCoord += 1;
	if (currentTexCoord == 4) {
		currentTexCoord = 0;
	}
}

// maybe using quaternions would be faster?
function multiply(point, m) {
	var oldPoint = vec4(point[0], point[1], point[2], 1.0);
	var newPoint = vec4(0.0, 0.0, 0.0, 1.0);
	newPoint[0] = (m[0][0] * oldPoint[0]) + (m[1][0] * oldPoint[1]) + (m[2][0] * oldPoint[2]);
	newPoint[1] = (m[0][1] * oldPoint[0]) + (m[1][1] * oldPoint[1]) + (m[2][1] * oldPoint[2]);
	newPoint[2] = (m[0][2] * oldPoint[0]) + (m[1][2] * oldPoint[1]) + (m[2][2] * oldPoint[2]);
	return newPoint;
	// I can ignore the fourth column because w = 1
}

function rotateCube(i, m) {
	// var cubePoints = [];
	for (j = i; j < i+36; ++j) {
		points[j] = multiply(points[j], m);
		// cubePoints.push(multiply(points[j], m));
	}
	// gl.bufferSubData(gl.ARRAY_BUFFER, i, flatten(cubePoints));
}

function rotateSection(m, cubes) {
	rotateCube(currentCubeLocs[cubes[0]], m);
	rotateCube(currentCubeLocs[cubes[1]], m);
	rotateCube(currentCubeLocs[cubes[2]], m);

	rotateCube(currentCubeLocs[cubes[3]], m);
	rotateCube(currentCubeLocs[cubes[4]], m);
	rotateCube(currentCubeLocs[cubes[5]], m);

	rotateCube(currentCubeLocs[cubes[6]], m);
	rotateCube(currentCubeLocs[cubes[7]], m);
	rotateCube(currentCubeLocs[cubes[8]], m);
}

function xAxisRotation(angle, cubes) {
	var c = Math.cos(angle * Math.PI / 180);
	var s = Math.sin(angle * Math.PI / 180);
	var rx = mat4(1.0,  0.0,  0.0, 0.0,
		    	  0.0,  c,  s, 0.0,
		    	  0.0, -s,  c, 0.0,
		    	  0.0,  0.0,  0.0, 1.0 );
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	rotateSection(rx, cubes);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
}

function yAxisRotation(angle, cubes) {
	var c = Math.cos(angle * Math.PI / 180);
	var s = Math.sin(angle * Math.PI / 180);
	var ry = mat4(c, 0.0, -s, 0.0,
		    	  0.0, 1.0,  0.0, 0.0,
		    	  s, 0.0,  c, 0.0,
		    	  0.0, 0.0,  0.0, 1.0);
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	rotateSection(ry, cubes);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
}

function zAxisRotation(angle, cubes) {
	var c = Math.cos(angle * Math.PI / 180);
	var s = Math.sin(angle * Math.PI / 180);
	var rz = mat4(c, s, 0.0, 0.0,
		    	  -s,  c, 0.0, 0.0,
		   	 	  0.0,  0.0, 1.0, 0.0,
		    	  0.0,  0.0, 0.0, 1.0);
	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	rotateSection(rz, cubes);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
}

function moveLocationPositive90X(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[2]];
	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[5]];
	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[8]];

	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[1]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[7]];

	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[0]];
	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[6]];
}

function moveLocationNegative90X(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[0]];
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[1]];
	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[2]];

	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[5]];

	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[6]];
	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[7]];
	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[8]];
}

function xSection(angle, cur, cubes) {
	var rotAngle = angle - currentAngle[cur]; // angle to rotate cube by
	xAxisRotation(rotAngle, cubes);
	currentAngle[cur] = angle;
	// updating where each cube is
	if (rotAngle > 0) {
		var numRotations = rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationPositive90X(cubes);
		}
	} else if (rotAngle < 0) {
		var numRotations = -rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationNegative90X(cubes);
		}
	}
}

function L(angle) { // is the issue with the angle?
	// this needs to be a 90 degree rotation, but where the angle changes until it gets to the
	// correct degree, rendering each time
	// idea I had for animation that didn't work:
	// for (var i = currentAngle[0]+1; i <= rotAngle; ++i) {
	// 	xAxisRotation(1, 0, 1, 2, 9, 10, 11, 18, 19, 20);
	// 	render();
	// }
	//
	// I still need to figure out bufferSubData
	xSection(angle, 0, [0, 1, 2, 9, 10, 11, 18, 19, 20]);
}

function xMid(angle) {
	xSection(angle, 1, [3, 4, 5, 12, 13, 14, 21, 22, 23]);
}

function R(angle) {
	xSection(angle, 2, [6, 7, 8, 15, 16, 17, 24, 25, 26]);
}

function moveLocationPositive90Y(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[6]];
	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[0]];

	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[7]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[1]];

	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[8]];
	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[5]];
	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[2]];
}

function moveLocationNegative90Y(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[0]];
	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[1]];
	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[2]];

	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[5]];

	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[6]];
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[7]];
	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[8]];
}

function ySection(angle, cur, cubes) {
	var rotAngle = angle - currentAngle[cur]; // angle to rotate cube by
	yAxisRotation(rotAngle, cubes);
	currentAngle[cur] = angle;
	// updating where each cube is
	if (rotAngle > 0) {
		var numRotations = rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationPositive90Y(cubes);
		}
	} else if (rotAngle < 0) {
		var numRotations = -rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationNegative90Y(cubes);
		}
	}
}

function U(angle) {
	ySection(angle, 3, [2, 5, 8, 11, 14, 17, 20, 23, 26]);
}

function yMid(angle) {
	ySection(angle, 4, [1, 4, 7, 10, 13, 16, 19, 22, 25]);
}

function D(angle) {
	ySection(angle, 5, [0, 3, 6, 9, 12, 15, 18, 21, 24]);
}

function moveLocationPositive90Z(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[2]];
	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[5]];
	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[8]];

	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[1]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[7]];

	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[0]];
	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[6]];
}

function moveLocationNegative90Z(cubes) {
	var prevCubeLocs = currentCubeLocs.slice();

	currentCubeLocs[cubes[2]] = prevCubeLocs[cubes[0]];
	currentCubeLocs[cubes[5]] = prevCubeLocs[cubes[1]];
	currentCubeLocs[cubes[8]] = prevCubeLocs[cubes[2]];

	currentCubeLocs[cubes[1]] = prevCubeLocs[cubes[3]];
	currentCubeLocs[cubes[4]] = prevCubeLocs[cubes[4]]; // not actually necessary
	currentCubeLocs[cubes[7]] = prevCubeLocs[cubes[5]];

	currentCubeLocs[cubes[0]] = prevCubeLocs[cubes[6]];
	currentCubeLocs[cubes[3]] = prevCubeLocs[cubes[7]];
	currentCubeLocs[cubes[6]] = prevCubeLocs[cubes[8]];
}

function zSection(angle, cur, cubes) {
	var rotAngle = angle - currentAngle[cur]; // angle to rotate cube by
	zAxisRotation(rotAngle, cubes);
	currentAngle[cur] = angle;
	// updating where each cube is
	if (rotAngle > 0) {
		var numRotations = rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationPositive90Z(cubes);
		}
	} else if (rotAngle < 0) {
		var numRotations = -rotAngle / 90;
		console.log(numRotations);
		for (var i = 0; i < numRotations; ++i) {
			moveLocationNegative90Z(cubes);
		}
	}
}

function F(angle) {
	zSection(angle, 6, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
}

function zMid(angle) {
	zSection(angle, 7, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
}

function B(angle) {
	zSection(angle, 8, [18, 19, 20, 21, 22, 23, 24, 25, 26]);
}

function reset() {
	// give options for traditional or goats
	points = originalPoints.slice(); // issue is, it's pass by reference
	currentCubeLocs = originalCubeLocs.slice();
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	document.getElementById("L").value = 0;
	document.getElementById("R").value = 0;
	document.getElementById("U").value = 0;
	document.getElementById("D").value = 0;
	document.getElementById("F").value = 0;
	document.getElementById("B").value = 0;
	center();
}

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	if (trackballMove) {
		mouseAxis = normalize(mouseAxis);
		var c = Math.cos(mouseAngle/2.0);
		var s = Math.sin(mouseAngle/2.0);
		var rotation = vec4(c, s*mouseAxis[0], s*mouseAxis[1], s*mouseAxis[2]);
		// rotationQuaterion = q
		rotationQuaternion = multq(rotationQuaternion, rotation);
		gl.uniform4fv(rotationQuaternionLoc, flatten(rotationQuaternion));
		// test
		// console.log('mouseAxis: ', mouseAxis);
		// console.log('mouseAngle: ', mouseAngle);
		// console.log('rotation: ', rotation);
		// console.log('rotationQuaternion: ', rotationQuaternion);
	}
	gl.drawArrays(gl.TRIANGLES, 0, points.length);
	requestAnimFrame(render);
}