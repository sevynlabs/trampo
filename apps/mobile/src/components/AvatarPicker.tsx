import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, colors } from './ds';
import { trpc } from '../lib/trpc';

type Mime = 'image/jpeg' | 'image/png' | 'image/webp';
const toMime = (m?: string | null): Mime => (m === 'image/png' || m === 'image/webp' ? m : 'image/jpeg');

/**
 * Profile photo with a camera badge. Tap → camera / gallery / remove.
 * Upload: signed URL from the API → PUT to Supabase Storage → confirm.
 */
export function AvatarPicker({ name, uri, size = 108, verified }: { name?: string | null; uri?: string | null; size?: number; verified?: boolean }) {
  const utils = trpc.useUtils();
  const getUrl = trpc.profiles.getAvatarUploadUrl.useMutation();
  const confirm = trpc.profiles.confirmAvatar.useMutation();
  const remove = trpc.profiles.removeAvatar.useMutation();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = preview ?? uri ?? null;

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    const mime = toMime(asset.mimeType);
    setPreview(asset.uri);
    setBusy(true);
    try {
      const { uploadUrl, path } = await getUrl.mutateAsync({ contentType: mime });
      const blob = await (await fetch(asset.uri)).blob();
      const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      await confirm.mutateAsync({ path });
      await utils.profiles.getMe.invalidate();
    } catch (e) {
      console.error('[avatar] upload failed', e);
      setPreview(null);
      Alert.alert('Não foi possível enviar a foto', 'Verifique sua conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão necessária', 'Libere o acesso à câmera nos Ajustes para tirar a foto.');
      const r = await ImagePicker.launchCameraAsync(opts);
      if (!r.canceled && r.assets[0]) upload(r.assets[0]);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão necessária', 'Libere o acesso às fotos nos Ajustes para escolher uma imagem.');
      const r = await ImagePicker.launchImageLibraryAsync(opts);
      if (!r.canceled && r.assets[0]) upload(r.assets[0]);
    }
  };

  const doRemove = async () => {
    setBusy(true);
    try {
      await remove.mutateAsync();
      setPreview(null);
      await utils.profiles.getMe.invalidate();
    } catch {
      Alert.alert('Erro', 'Não foi possível remover a foto.');
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (busy) return;
    if (Platform.OS === 'web') return pick('library');
    const buttons = [
      { text: 'Tirar foto', onPress: () => pick('camera') },
      { text: 'Escolher da galeria', onPress: () => pick('library') },
      ...(shown ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: doRemove }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ];
    Alert.alert('Foto do perfil', undefined, buttons);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Alterar foto do perfil" hitSlop={8}>
        <View>
          <Avatar name={name} uri={shown} size={size} verified={verified} />
          {busy && (
            <View style={{ position: 'absolute', inset: 0, borderRadius: size / 2, backgroundColor: 'rgba(4,30,66,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={{ position: 'absolute', left: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.orange, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </View>
      </Pressable>
      <Pressable onPress={open} hitSlop={8} accessibilityRole="button" style={{ marginTop: 10 }}>
        <Text style={{ color: colors.orange, fontWeight: '800' }}>{shown ? 'Trocar foto' : 'Adicionar foto'}</Text>
      </Pressable>
    </View>
  );
}
