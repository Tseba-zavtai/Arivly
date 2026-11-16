import { Image as ExpoImage } from "expo-image";
import { useState, type ReactNode } from "react";
import { Image, Platform, View, type ImageSourcePropType, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";

export default function ListingImage({ source, style, contentFit = "cover", transition, fallback }: {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
  transition?: number;
  fallback?: ReactNode;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const uri = typeof source === "object" && !Array.isArray(source) ? source.uri : undefined;
  const onError = fallback && uri ? () => setFailedUri(uri) : undefined;
  if (fallback && uri && failedUri === uri) {
    return <View style={[style as StyleProp<ViewStyle>, { justifyContent: "center", alignItems: "center" }]}>{fallback}</View>;
  }
  if (Platform.OS === "android") {
    return <Image source={source} style={style} resizeMode={contentFit} onError={onError} />;
  }
  return <ExpoImage source={source} style={style} contentFit={contentFit} transition={transition} onError={onError} />;
}
