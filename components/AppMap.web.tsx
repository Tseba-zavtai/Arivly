import React, { Children, forwardRef, isValidElement, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import type * as Leaflet from 'leaflet';

type Coordinate = { latitude: number; longitude: number };
type Region = Coordinate & { latitudeDelta?: number; longitudeDelta?: number };
type MarkerProps = { coordinate: Coordinate; title?: string; onPress?: () => void };
type CircleProps = { center: Coordinate; radius: number; strokeColor?: string; fillColor?: string; strokeWidth?: number };
export function Marker(_props: MarkerProps) { return null; }
export function Circle(_props: CircleProps) { return null; }
type Props = {
  style?: React.ComponentProps<typeof View>['style']; children?: React.ReactNode;
  initialRegion?: Region; region?: Region; onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  onRegionChangeComplete?: (region: Region) => void; showsUserLocation?: boolean; showsMyLocationButton?: boolean;
};
export const MapView = forwardRef(function WebMap(props: Props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const api = useRef<typeof Leaflet | undefined>(undefined);
  const current = useRef(props); current.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useImperativeHandle(ref, () => ({ animateToRegion(region: Region) { map.current?.setView([region.latitude, region.longitude], 14); } }), []);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    import('leaflet').then(module => {
      if (disposed || !host.current) return;
      const L = module.default ?? module; api.current = L;
      const center = current.current.region ?? current.current.initialRegion ?? { latitude: 47.9184, longitude: 106.9177 };
      const instance = L.map(host.current, { scrollWheelZoom: false }).setView([center.latitude, center.longitude], 13);
      map.current = instance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(instance);
      instance.on('click', event => current.current.onPress?.({ nativeEvent: { coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng } } }));
      instance.on('moveend', () => {
        const center = instance.getCenter(), bounds = instance.getBounds();
        current.current.onRegionChangeComplete?.({ latitude: center.lat, longitude: center.lng, latitudeDelta: bounds.getNorth() - bounds.getSouth(), longitudeDelta: bounds.getEast() - bounds.getWest() });
      });
      resize = new ResizeObserver(() => instance.invalidateSize()); resize.observe(host.current);
      setReady(true);
    }).catch(() => setError('Газрын зураг ачаалсангүй. Хуудсаа дахин нээнэ үү.'));
    return () => { disposed = true; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const L = api.current, instance = map.current;
    if (!ready || !L || !instance) return;
    const layer = L.layerGroup().addTo(instance);
    Children.forEach(props.children, child => {
      if (!isValidElement(child)) return;
      if (child.type === Marker) {
        const item = child.props as MarkerProps;
        const marker = L.circleMarker([item.coordinate.latitude, item.coordinate.longitude], { radius: 9, color: '#fff', weight: 3, fillColor: '#6e0ab0', fillOpacity: 1 }).addTo(layer);
        if (item.title) { const label = document.createElement('span'); label.textContent = item.title; marker.bindTooltip(label); }
        marker.on('click', event => { L.DomEvent.stopPropagation(event); item.onPress?.(); });
      } else if (child.type === Circle) {
        const item = child.props as CircleProps;
        L.circle([item.center.latitude, item.center.longitude], { radius: item.radius, color: item.strokeColor, fillColor: item.fillColor, weight: item.strokeWidth }).addTo(layer);
      }
    });
    return () => { layer.remove(); };
  }, [ready, props.children]);
  useEffect(() => {
    const instance = map.current, region = props.region;
    if (!ready || !instance || !region) return;
    const center = instance.getCenter();
    if (Math.abs(center.lat - region.latitude) + Math.abs(center.lng - region.longitude) > 0.00001) instance.panTo([region.latitude, region.longitude]);
  }, [ready, props.region]);
  return <View style={[{ minHeight: 260, overflow: 'hidden' }, props.style]}>
    <div ref={host} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Газрын зураг" />
    {error && <div role="alert">{error}</div>}
  </View>;
});
