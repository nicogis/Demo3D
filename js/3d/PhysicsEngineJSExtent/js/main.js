/* -----------------------------------------------------------------------------------
   Developed by the Applications Prototype Lab
   (c) 2015 Esri | http://www.esri.com/legal/software-license  
----------------------------------------------------------------------------------- */

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
    'esri/geometry/geometryEngine',
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
    geometryEngine,
    on
    ) {
    $(document).ready(function () {
        // Enforce strict mode
        'use strict';

        // Cannon physics engine constants
        var FPS = 60;
        var MAXSUBSTEPS = 3;
        var ALTITUDE_THRESHOLD = 50000;

        // Twgl variables
        var _gl = null;
        var _programInfo = null;
        var _ball = null;

        // Cannon variables
        var _world = null;
        var _material = null;

        // Create map and view
        var _camera = null;
        var _map = new Map({
            basemap: 'satellite'
        });

        var _graphicsLayer = new GraphicsLayer();
        _map.add(_graphicsLayer);

        var _view = new SceneView({
            container: 'map',
            map: _map,
            camera: Camera.fromJSON({
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
            })
        });

        //_view.animateTo();

        _view.then(function () {

            //showDelayedBanner('Welcome to Boxes, Balls & Barrels!', 1000);

            //showDelayedBanner('Please zoom in or select an entry from the "Quick Links" dropdown', 3000);

            // Get a reference to the internal camera
            _camera = _view._stage.getCamera();

            _view.watch('camera', function () {
                //console.log(_view.camera.position);
                if (_view.camera.position.z > ALTITUDE_THRESHOLD) {
                    //showDelayedBanner('Please zoom in or select an entry from the "Quick Links" dropdown', 3000);
                } else {
                    //showDelayedBanner('Tap on the terrain to initiate a drop', 3000);
                }
            });
        });
        on(_view, 'tap', function (e) {
            // Exit if invalid or missing map point
            if (!e || !e.mapPoint) { return; }

            // Too high
            if (_view.camera.position.z > ALTITUDE_THRESHOLD) { return; }

            // gravity 1.622, 3.711, 9.807, 24.79
            // elevation size 250, 500, 750, 1000, 2000
            // elevation resolution 5, 10, 20, 50, 100
            createPhysicsEnvironment(
                e.mapPoint,
                9.807 /*gravity*/,
                3000 /* elevation-size */,
                10 /* elevation resolution */
            );

            //shape ball, barrel, box, cone
            //color color1,color2,color3
            //size 1, 2, 5, 10, 20, 50
            //gap 0, 1, 2, 5, 10, 20
            //rows 1, 2, 4, 6, 8, 10
            //columns 1, 2, 4, 6, 8, 10
            //levels 1, 2, 4, 6, 8, 10
            //height 0, 10, 20, 50, 100, 200
            // function createWebglEnvironment(point, shape, color, size, gap, rows, columns, levels, height)
            createWebglEnvironment(
                e.mapPoint,
                'ball', /* shape */
                'color1', /*color*/
                10 /* size */,
                1 /* gap */,
                4 /* rows */,
                4 /* columns */,
                4 /* levels */,
                50 /* height */
            );
        });



        function createPhysicsEnvironment(point, gravity, size, separation) {
            var columns = Math.round(size / separation);
            var rows = Math.round(size / separation);

            // Create default material
            _material = new CANNON.Material();

            // Create world
            _world = new CANNON.World();
            //_world.broadphase = new CANNON.NaiveBroadphase();
            _world.gravity.set(0, 0, -gravity);
            _world.addContactMaterial(new CANNON.ContactMaterial(_material, _material, {
                friction: 0.3,   // 0.06,
                restitution: 0.3 // 0.0
            }));

            //
            var matrix = [];
            
            var plx0 = [];
            var plmy = [];
            var plxm = [];
            var pl0y = [];
            for (var i = 0; i < columns; i++) {
                var column = [];
                for (var j = 0; j < rows; j++) {
                    var x = point.x + i * separation - (separation * columns / 2);
                    var y = point.y + j * separation - (separation * rows / 2);
                    var p = new Point(x, y, 0, _map.spatialReference);
                    var z = _view.basemapTerrain.getElevation(p);

                    var pt = [x, y];

                    if (i == 0) {
                        pl0y.push(pt);  
                    }
                    else if (j == 0) {
                        plx0.push(pt); 
                    }
                    else if (i == (columns - 1)) {
                        plmy.push(pt);
                    }
                    else if (j == (rows - 1)) {
                        plxm.push(pt);
                    }
                   
                    column.push(z);
                }
                matrix.push(column);
            }

            plxm.reverse();
            pl0y.reverse();

            var pathsPl = plx0.concat(plmy).concat(plxm).concat(pl0y);


            var polyline = new Polyline({ spatialReference: _map.spatialReference, paths: pathsPl });

            polyline = geometryEngine.densify(polyline, 50, "meters");

            var k,t,z;      
            for (i = 0; i < polyline.paths.length; i++) {
                 for (j = 0; j < polyline.paths[i].length; j++) {
                      k = polyline.paths[i][j];
                      t = new Point(k.x, k.y, 0, _map.spatialReference);
                      z = _view.basemapTerrain.getElevation(t);
                      polyline.paths[i][j].push(z);
                 }
            }


            var lineSymbol = new SimpleLineSymbol({
                  color: [226, 119, 40],
                  width: 4
              });

            var polylineGraphic = new Graphic({
                geometry: polyline,
                symbol: lineSymbol
            });

            _graphicsLayer.clear();
            _graphicsLayer.add(polylineGraphic);


            // Create Surface
            _world.addBody(new CANNON.Body({
                mass: 0,
                material: _material,
                type: CANNON.Body.STATIC,
                shape: new CANNON.Heightfield(matrix, {
                    elementSize: separation
                }),
                //shape: new CANNON.Trimesh(verts, faces),
                position: new CANNON.Vec3(
                    point.x - (separation * columns / 2),
                    point.y - (separation * rows / 2),
                    0
                )
            }));

            // -x
            _world.addBody(new CANNON.Body({
                position: new CANNON.Vec3(point.x + 0 * separation - (separation * columns / 2), 0, 0),
                quaternion: new CANNON.Quaternion(0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)),
                shape: new CANNON.Plane(),
                mass: 0,
                material: _material,
                type: CANNON.Body.STATIC
            }));

            // +x
            _world.addBody(new CANNON.Body({
                position: new CANNON.Vec3(point.x + (columns - 1) * separation - (separation * columns / 2), 0, 0),
                quaternion: new CANNON.Quaternion(0, Math.sin(-Math.PI / 4), 0, Math.cos(-Math.PI / 4)),
                shape: new CANNON.Plane(),
                mass: 0,
                material: _material,
                type: CANNON.Body.STATIC
            }));

            // -y
            _world.addBody(new CANNON.Body({
                position: new CANNON.Vec3(0, point.y + 0 * separation - (separation * rows / 2), 0),
                quaternion: new CANNON.Quaternion(Math.sin(-Math.PI / 4), 0, 0, Math.cos(-Math.PI / 4)),
                shape: new CANNON.Plane(),
                mass: 0,
                material: _material,
                type: CANNON.Body.STATIC
            }));

            // +y
            _world.addBody(new CANNON.Body({
                position: new CANNON.Vec3(0, point.y + (rows - 1) * separation - (separation * rows / 2), 0),
                quaternion: new CANNON.Quaternion(Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)),
                shape: new CANNON.Plane(),
                mass: 0,
                material: _material,
                type: CANNON.Body.STATIC
            }));
        }

        function createWebglEnvironment(point, shape, color, size, gap, rows, columns, levels, height) {
            // Disable idle frame refreshes
            _view._stage.setRenderParams({
                idleSuspend: false
            });

            // Get webgl context
            _gl = twgl.getWebGLContext(_view.canvas);

            // Set attribute prefix in vertex shader
            twgl.setAttributePrefix('a_');

            // Create vertex and fragment shader from embedded scripts
            _programInfo = twgl.createProgramInfo(_gl, ['vs', 'fs']);

            //
            var color1 = null;
            var color2 = null;
            switch (color) {
                case 'color1':
                    color1 = [247, 180, 1, 255];
                    color2 = [1, 68, 247, 255];
                    break;
                case 'color2':
                    color1 = [255, 255, 255, 255];
                    color2 = [254, 0, 0, 255];
                    break;
                case 'color3':
                    color1 = [0, 255, 0, 255];
                    color2 = [255, 215, 0, 255];
                    break;
            }

            // Create texture
            var texture = twgl.createTexture(_gl, {
                min: _gl.NEAREST,
                mag: _gl.NEAREST,
                src: [].concat(color1, color2, color2, color1)
            });

            // Set the light source for 10,000m above drop site
            var clone = point.clone();
            clone.z += 10000;
            var light = new Float32Array(3);
            _view.coordinateSystemHelper.pointToEnginePosition(clone, light);

            // Define shader values
            var uniforms = {
                u_lightWorldPos: light,
                u_lightColor: [1, 1, 1, 1],
                u_ambient: [0.2, 0.2, 0.2, 1],
                u_specular: [1, 1, 1, 1],
                u_specularFactor: 0.5,
                u_shininess: 50,
                u_diffuse: texture
            };

            // Create vertex, normal and texture coordinates
            var bufferInfo = null;
            var cannonShape = null;
            switch (shape) {
                case 'box':
                    bufferInfo = twgl.primitives.createCubeBufferInfo(_gl, size);
                    cannonShape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
                    break;
                case 'ball':
                    bufferInfo = twgl.primitives.createSphereBufferInfo(_gl, size / 2, 24, 12);
                    cannonShape = new CANNON.Sphere(size / 2);
                    break;
                case 'barrel':
                    bufferInfo = twgl.primitives.createCylinderBufferInfo(_gl, size / 2, size, 12, 2, true, true);
                    cannonShape = new CANNON.Cylinder(size / 2, size / 2, size, 12);
                    break;
                case 'cone':
                    bufferInfo = twgl.primitives.createTruncatedConeBufferInfo(_gl, size / 2, 0, size, 12, 2, true, true);
                    cannonShape = new CANNON.Cylinder(0, size / 2, size, 12);
                    break;
            }

            // Store draw properties
            _ball = {
                bufferInfo: bufferInfo,
                uniforms: uniforms
            };

            //var markerSymbol = new SimpleMarkerSymbol({
            //    color: [226, 119, 40],

            //    outline: new SimpleLineSymbol({
            //        color: [255, 255, 255],
            //        width: 2
            //    })
            //});

            //var pointGraphic = null;

            for (var i = 0; i < columns; i++) {
                for (var j = 0; j < rows; j++) {
                    for (var k = 0; k < levels; k++) {
                        var separation = size + gap;
                        var x = point.x + (i * separation) - (columns * separation / 2);
                        var y = point.y + (j * separation) - (rows * separation / 2);
                        var z = point.z + (k * separation) + height;
                        var p = new Point(x, y, z, _map.spatialReference);


                        //pointGraphic = new Graphic({
                        //    geometry: p,
                        //    symbol: markerSymbol
                        //});

                        //_graphicsLayer.add(pointGraphic);



                        // Add physics object
                        var body = new CANNON.Body({
                            position: new CANNON.Vec3(x, y, z),
                            mass: 1000,
                            material: _material,
                            shape: cannonShape,
                            type: CANNON.Body.DYNAMIC,
                            linearDamping: 0.01,
                            angularDamping: 0.01,
                            allowSleep: true,
                            sleepSpeedLimit: 0.1,
                            sleepTimeLimit: 1,
                            collisionFilterGroup: 1,
                            collisionFilterMask: 1,
                            fixedRotation: false
                        });
                        body.map = p;
                        _world.addBody(body);
                    }
                }
            }
        }
        function quaternionToRotationMatrix(q) {
            var te = new Float32Array(16);

            var x = q.x, y = q.y, z = q.z, w = q.w;
            var x2 = x + x, y2 = y + y, z2 = z + z;
            var xx = x * x2, xy = x * y2, xz = x * z2;
            var yy = y * y2, yz = y * z2, zz = z * z2;
            var wx = w * x2, wy = w * y2, wz = w * z2;

            te[0] = 1 - (yy + zz);
            te[4] = xy - wz;
            te[8] = xz + wy;

            te[1] = xy + wz;
            te[5] = 1 - (xx + zz);
            te[9] = yz - wx;

            te[2] = xz - wy;
            te[6] = yz + wx;
            te[10] = 1 - (xx + yy);

            // last column
            te[3] = 0;
            te[7] = 0;
            te[11] = 0;

            // bottom row
            te[12] = 0;
            te[13] = 0;
            te[14] = 0;
            te[15] = 1;

            return te;
        }

        // Format strings
        String.prototype.format = function () {
            var s = this;
            var i = arguments.length;
            while (i--) {
                s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
            }
            return s;
        };

        // Draw loop
        Scheduler.addFrameTask({
            postRender: function (time, deltaTime, timeFromBeginning, spendInFrame) {

                //console.log(time, deltaTime, timeFromBeginning, spendInFrame);

                // Exit if not webgl context or no objects addded
                if (_gl === null) { return; }
                if (_world.bodies.length === 0) { return; }

                // Increment physics engine
                _world.step(1 / FPS, deltaTime, MAXSUBSTEPS);

                // Get view and projection matrix from Esri camera
                var view = _camera.viewMatrix;
                var projection = _camera.projectionMatrix;

                // Calculate derived matrices
                var viewProjection = twgl.m4.multiply(view, projection);
                var viewInverse = twgl.m4.inverse(view);

                // Assign shader
                _gl.useProgram(_programInfo.program);
                _ball.uniforms.u_viewInverse = viewInverse;

                // Draw every box, ball or barrel
                $.each(_world.bodies, function () {
                    // Only draw dynamic bodies, that is, skip heightfield and walls
                    if (this.type !== CANNON.Body.DYNAMIC) { return true; }

                    // Create Esri point from x,y,z location calculated by Cannon
                    var point = new Point(
                        this.position.x,
                        this.position.y,
                        this.position.z,
                        _map.spatialReference
                    );

                    // Get world transformation from web mercator to webgl
                    var world = new Float32Array(16);
                    _view.coordinateSystemHelper.pointToEngineTransformation(point, world);

                    // Apply body rotation to world transformation
                    twgl.m4.multiply(quaternionToRotationMatrix(this.quaternion), world, world);

                    // Combine rotation and translation
                    var worldInverseTranspose = twgl.m4.transpose(twgl.m4.inverse(world));
                    var worldViewProjection = twgl.m4.multiply(world, viewProjection);

                    // Update shader variables
                    _ball.uniforms.u_world = world;
                    _ball.uniforms.u_worldInverseTranspose = worldInverseTranspose;
                    _ball.uniforms.u_worldViewProjection = worldViewProjection;

                    // Assign vertice buffer and matrices to shader
                    twgl.setBuffersAndAttributes(_gl, _programInfo, _ball.bufferInfo);
                    twgl.setUniforms(_programInfo, _ball.uniforms);

                    // Draw ball
                    _gl.drawElements(_gl.TRIANGLES, _ball.bufferInfo.numElements, _gl.UNSIGNED_SHORT, 0);
                });
            }
        });
    });
});