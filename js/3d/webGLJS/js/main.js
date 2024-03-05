require([
    'esri/Map',
    'esri/Camera',
    'esri/core/Scheduler',
    'esri/views/SceneView',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/geometry/SpatialReference',
    'esri/layers/GraphicsLayer',
    'esri/Graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'dojo/on',
    'dojo/domReady!'
],
function (
    Map,
    Camera,
    Scheduler,
    SceneView,
    Point,
    Polyline,
    SpatialReference,
    GraphicsLayer,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    on
    ) {
     
    var gl = null;
    var programInfo = null;
    var bufferInfo = null;
    var m4 = null;
    var point = null;
    var uniforms = null;
    var OFFSET_Z = 100;

    var camera = Camera.fromJSON({
        "position": {
            "x": 1012720.359723827,
            "y": 5849834.779169721,
            "spatialReference": {
                "wkid": 102100,
                "latestWkid": 3857
            },
            "z": 4650.896002463065
        },
        "heading": 43.030848766145446,
        "tilt": 62.539669241022835
    });

    var map = new Map({
        basemap: 'satellite'
    });

    var view = new SceneView({
        container: 'map',
        map: map,
        camera: camera
    });

    view.then(function () {

        camera = view._stage.getCamera();
        view.watch('camera', function () {
            
        });
    });

    on(view, 'tap', function (e) {
        // Exit if invalid or missing map point
        if (!e || !e.mapPoint) { return; }

        // Too high
        //if (_view.camera.position.z > ALTITUDE_THRESHOLD) { return; }

        view._stage.setRenderParams({
            idleSuspend: false
        });

        gl = twgl.getWebGLContext(view.canvas);
        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        twgl.setAttributePrefix("a_");
        m4 = twgl.m4;
        point = e.mapPoint;
        point.z += OFFSET_Z;

        programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);
        
        var arrays = {
            position: [10, 10, -10, 10, 10, 10, 10, -10, 10, 10, -10, -10, -10, 10, 10, -10, 10, -10, -10, -10, -10, -10, -10, 10, -10, 10, 10, 10, 10, 10, 10, 10, -10, -10, 10, -10, -10, -10, -10, 10, -10, -10, 10, -10, 10, -10, -10, 10, 10, 10, 10, -10, 10, 10, -10, -10, 10, 10, -10, 10, -10, 10, -10, 10, 10, -10, 10, -10, -10, -10, -10, -10], 
            normal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
            texcoord: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
            indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
        };



        bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

        var tex = twgl.createTexture(gl, {
            min: gl.NEAREST,
            mag: gl.NEAREST,
            src: [
              255, 255, 255, 255,
              192, 192, 192, 255,
              192, 192, 192, 255,
              255, 255, 255, 255,
            ],
        });


        var clone = point.clone();
        clone.z += 10000;
        var light = new Float32Array(3);
        view.coordinateSystemHelper.pointToEnginePosition(clone, light);

        uniforms = {
            u_lightWorldPos: light,
            u_lightColor: [1, 0.8, 0.8, 1],
            u_ambient: [0, 0, 0, 1],
            u_specular: [1, 1, 1, 1],
            u_shininess: 50,
            u_specularFactor: 1,
            u_diffuse: tex,
        };


        
    });

    Scheduler.addFrameTask({
        postRender: function (time, deltaTime, timeFromBeginning, spendInFrame) {

            if (gl === null) { return; }

            
           
            // Get view and projection matrix from Esri camera
            var viewC = camera.viewMatrix;
            var projection = camera.projectionMatrix;

            
            var viewInverse = twgl.m4.inverse(viewC);
            var viewProjection = m4.multiply(viewC, projection);
            
            var world = new Float32Array(16);
            view.coordinateSystemHelper.pointToEngineTransformation(point, world);
            
            point.x += 5;
            point.y += 5;
            var p = new Point(point.x, point.y, 0, map.spatialReference);
            point.z = view.basemapTerrain.getElevation(p) + OFFSET_Z;
             

            twgl.m4.multiply(m4.rotationY(time), world, world);
            twgl.m4.multiply(m4.rotationX(time), world, world);

            var worldInverseTranspose = twgl.m4.transpose(twgl.m4.inverse(world));
            var worldViewProjection = twgl.m4.multiply(world, viewProjection);

            uniforms.u_viewInverse = viewInverse;
            uniforms.u_world = world;
            uniforms.u_worldInverseTranspose = worldInverseTranspose;
            uniforms.u_worldViewProjection = worldViewProjection;

            gl.useProgram(programInfo.program);
            twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
            twgl.setUniforms(programInfo, uniforms);
            gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
            

        }
    });

});