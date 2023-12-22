document.addEventListener("DOMContentLoaded", function(){
    let maps = document.getElementsByClassName("c-map-embed");

    L.Icon.Default.imagePath = '/assets/images/map/';

    for (let i = 0; i < maps.length; i++) {
        let mapEl = maps[i];
        let map = L.map(mapEl, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
            .addTo(map);
        let latitude = mapEl.getAttribute('maplat');
        let longitude = mapEl.getAttribute('maplong');
        let marker = L.marker([latitude, longitude]).addTo(map);
        let bounds = [[latitude, longitude]];
        map.fitBounds(bounds);
    }
});