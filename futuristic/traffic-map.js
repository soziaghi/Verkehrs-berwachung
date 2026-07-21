const NUERNBERG_CENTER = { lat: 49.4521, lng: 11.0767 };

function initTrafficMap() {
  const map = new google.maps.Map(document.getElementById("trafficMap"), {
    center: NUERNBERG_CENTER,
    zoom: 9,
    mapTypeControl: false,
    streetViewControl: false,
  });
  new google.maps.TrafficLayer().setMap(map);
}

function loadGoogleMaps() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=initTrafficMap&loading=async`;
  script.async = true;
  script.onerror = () => {
    const el = document.getElementById("trafficMap");
    el.textContent = "Google-Maps-Verkehrskarte konnte nicht geladen werden.";
  };
  document.head.appendChild(script);
}

loadGoogleMaps();
