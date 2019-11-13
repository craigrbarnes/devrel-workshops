const canvas = document.getElementById('map');
const map = new harp.MapView({
   canvas,
   theme: "https://unpkg.com/@here/harp-map-theme@latest/resources/berlin_tilezen_night_reduced.json",
   //For tile cache optimization:
   maxVisibleDataSourceTiles: 40, 
   tileCacheSize: 100
});

// HERE Credentials

const APP_ID = "wq8WzMlUQ8Eqr95STMJQ";
const APP_CODE = "1aWy4m5Eq4bi1jWF2UxgVQ&";

// Setting the center will use this for both isoline and Places
let center = new harp.GeoCoordinates(52.5302998,13.3852865);
map.setCameraGeolocationAndZoom(
   center,
   15
);

const mapControls = new harp.MapControls(map);
const ui = new harp.MapControlsUI(mapControls);
canvas.parentElement.appendChild(ui.domElement);

mapControls.maxPitchAngle = 75;
map.resize(window.innerWidth, window.innerHeight);
window.onresize = () => map.resize(window.innerWidth, window.innerHeight);

const omvDataSource = new harp.OmvDataSource({
   baseUrl: "https://xyz.api.here.com/tiles/herebase.02",
   apiFormat: harp.APIFormat.XYZOMV,
   styleSetName: "tilezen",
   authenticationCode: 'ADzyeEu3zoVRneqtP2vTnto', // YOUR API Code
});
map.addDataSource(omvDataSource);

/// request the isonline
let url = "https://isoline.route.api.here.com/routing/7.2/calculateisoline.json?" +
    "app_id="+APP_ID+"&app_code=" + APP_CODE +
    "&mode=shortest;car;traffic:disabled" +
    "&start=geo!"+center.latitude.toString()+","+center.longitude.toString()+"&range=7200&rangetype=time";

// create a geojson object representing the isoline route, using javascript
var isoline =  fetch(url)
   .then(response => response.json())
   .then(data => {
       return { 
        type: "FeatureCollection", "features": [   
        {
        type : "Feature", geometry: { type:"Polygon", coordinates : [ data.response.isoline[0].component[0].shape.map(function(e) {
           return e.split(",").map(d => parseFloat(d)).reverse(); // swap lat/lon lon/lat
       }).reverse() ] // isoline coords are in wrong order for geojson spec
       } , properties: { id: data.response.isoline[0].component[0].id }} ] };
    }
);


// wait for data from Promise, add to map and style it
isoline.then(data => {
 
    const geoJsonDataProvider = new harp.GeoJsonDataProvider("iso-line", data);
    const geoJsonDataSource = new harp.OmvDataSource({
       dataProvider: geoJsonDataProvider,
       name: "iso-line"
    });

    map.addDataSource(geoJsonDataSource).then(() => {
        const styles = [{
           "when": "$geometryType ^= 'polygon'",
           "renderOrder": 400,
           "technique": "fill",
           "attr": {
              "color": "#D73060",
              "transparent": true,
              "opacity": 0.5,
           }
        }]
     
        geoJsonDataSource.setStyleSet(styles); // add to map
        map.update();
        
    } );
});

// Places

// get the places in this case food and drink Places within 3 km
let places_url = "https://places.cit.api.here.com/places/v1/discover/search" +
    "?in="+center.latitude.toString()+","+center.longitude.toString()+";r=3000"+
    "&q=food and drink" +
    "&app_id="+APP_ID+"&app_code="+APP_CODE +
    "&size=400"; // get a good number of results, default is 20

// create the places using turf which is easier than above
var places =  fetch(places_url)
    .then(response => response.json())
    .then(data => {
        return turf.points(data.results.items.map(function(e) {
            return e.position.reverse();
        }));
    });

places.then(pois =>{
    isoline.then(isoline => {

        // clip places by isoline polygon using turf.js
        let filtered_places = turf.pointsWithinPolygon(pois, isoline);
        const placesJsonDataProvider = new harp.GeoJsonDataProvider("filtered-places", filtered_places);
        const placesJsonDataSource = new harp.OmvDataSource({
            dataProvider: placesJsonDataProvider,
            name: "filtered-places"
        });

        // Add to the map and style
        map.addDataSource(placesJsonDataSource).then(() => {
            const styles = [{
                "when": "$geometryType ^= 'point'",
                "renderOrder": 1000,
                "technique": "circles",
                "attr": {
                    "color": "#0f3eed",
                    "size": 15,
                }
            }]

            placesJsonDataSource.setStyleSet(styles);
            map.update();

        });
    });
});

