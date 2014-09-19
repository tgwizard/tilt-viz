(function() {
  var socket = io();
  var rotation = { alpha: 0, beta: 90, gamma: 0 }; // initial rotation

  var c = document.getElementById('container');
  var setDisplay = document.getElementById('set-display');
  var setDevice = document.getElementById('set-device');

  setDevice.addEventListener('click', setDeviceEventListener);
  setDisplay.addEventListener('click', setDisplayEventListener);

  function setDeviceEventListener(event) {
    event.stopPropagation();
    c.innerHTML = '<canvas style="background-color: hsl(0, 57%, 45%)"></canvas>';
    setDevice.removeEventListener('click', setDeviceEventListener);
    setDisplay.removeEventListener('click', setDisplayEventListener);
    fullScreen();
    setupDeviceClient();
  }

  function setDisplayEventListener(event) {
    event.stopPropagation();
    c.innerHTML = '<canvas id="glcanvas"></canvas>';
    setDevice.removeEventListener('click', setDeviceEventListener);
    setDisplay.removeEventListener('click', setDisplayEventListener);
    fullScreen();
    setupDisplayClient();
  }

  function fullScreen() {
    var c = document.querySelector('canvas');
    if(c.requestFullscreen) {
      c.requestFullscreen();
    } else if(c.mozRequestFullScreen) {
      c.mozRequestFullScreen();
    } else if(c.webkitRequestFullscreen) {
      c.webkitRequestFullscreen();
    } else if(c.msRequestFullscreen) {
      c.msRequestFullscreen();
    }
  }

  function setupDeviceClient() {
    window.addEventListener('deviceorientation', function(event) {
      var alpha = event.alpha; // direction
      var beta = event.beta; // tilt front-back
      var gamma = event.gamma; // tilt left-right

      var data = { alpha: alpha, beta: beta, gamma: gamma };
      socket.emit('orientation data', data);
    });
  }

  function setupDisplayClient() {
    socket.on('orientation data', function(data) {
      console.log('orientation data', data);
      if (!data) return;
      rotation = data;
    });

    // webgl
    // https://developer.mozilla.org/en-US/docs/Web/WebGL/Adding_2D_content_to_a_WebGL_context
    var canvas = document.getElementById('glcanvas');
    gl = canvas.getContext('webgl');
    if (!gl) return alert('web gl not enabled');

    function getViewPortSize() {
      // http://stackoverflow.com/questions/1248081/get-the-browser-viewport-dimensions-with-javascript
      var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      return { w: w, h: h };
    }

    function setViewPort() {
      var vp = getViewPortSize();
      console.log('viewport', vp);
      gl.viewport(0, 0, vp.w, vp.h);
      canvas.width = vp.w;
      canvas.height = vp.h;
    }

    setViewPort();
    window.onresize = setViewPort;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var perspectiveMatrix;
    var mvMatrix;
    var mvMatrixStack = [];

    var vertexPositionAttribute;
    var shaderProgram = initShaders(gl);
    var vertexBuffer = initVertexBuffer(gl);
    setInterval(drawScene, 15);
    drawScene();

    function initShaders(gl) {
      var fragmentShader = getShader(gl, "shader-fs");
      var vertexShader = getShader(gl, "shader-vs");

      var shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) return alert("Unable to initialize the shader program.");

      gl.useProgram(shaderProgram);

      vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
      gl.enableVertexAttribArray(vertexPositionAttribute);
      return shaderProgram;
    }

    function getShader(gl, id) {
      var shaderScript = document.getElementById(id);

      var theSource = "";
      var currentChild = shaderScript.firstChild;
      while(currentChild) {
        if (currentChild.nodeType == currentChild.TEXT_NODE) theSource += currentChild.textContent;
        currentChild = currentChild.nextSibling;
      }

      var shader;
      if (shaderScript.type == "x-shader/x-fragment") shader = gl.createShader(gl.FRAGMENT_SHADER);
      else if (shaderScript.type == "x-shader/x-vertex") shader = gl.createShader(gl.VERTEX_SHADER);

      gl.shaderSource(shader, theSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        return null;
      }

      return shader;
    }

    function initVertexBuffer(gl) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);

      var vertices = [
        1.0,  1.5,  0.0,
        -1.0, 1.5,  0.0,
        1.0,  -1.0, 0.0,
        -1.0, -1.0, 0.0,
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      return b;
    }

    function drawScene() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Establish the perspective with which we want to view the
      // scene. Our field of view is 45 degrees, with a width/height
      // ratio of vp.w:vp.h (e.g. 640:480), and we only want to see objects between 0.1 units
      // and 100 units away from the camera.
      var vp = getViewPortSize();
      perspectiveMatrix = makePerspective(90, vp.w/vp.h, 0.1, 100.0);

      loadIdentity();

      mvTranslate([-0.0, 0.0, -6.0]);

      mvPushMatrix();
      mvRotate(rotation.beta + 90, [1, 0, 0]);
      mvRotate(rotation.gamma, [0, 1, 0]);
      mvRotate(-rotation.alpha, [0, 0, 1]);

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

      setMatrixUniforms();
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      mvPopMatrix();
    }

    function loadIdentity() {
      mvMatrix = Matrix.I(4);
    }

    function multMatrix(n) {
      mvMatrix = mvMatrix.x(n);
    }

    function mvTranslate(v) {
      multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
    }

    function setMatrixUniforms() {
      var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
      gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

      var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
      gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
    }

    function mvPushMatrix(m) {
      if (m) {
        mvMatrixStack.push(m.dup());
        mvMatrix = m.dup();
      } else {
        mvMatrixStack.push(mvMatrix.dup());
      }
    }

    function mvPopMatrix() {
      if (!mvMatrixStack.length) {
        throw("Can't pop from an empty matrix stack.");
      }

      mvMatrix = mvMatrixStack.pop();
      return mvMatrix;
    }

    function mvRotate(angle, v) {
      var inRadians = angle * Math.PI / 180.0;

      var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
      multMatrix(m);
    }
  }
})();
