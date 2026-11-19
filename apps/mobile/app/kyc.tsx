import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { trpc } from '../src/lib/trpc';
import { GradientButton } from '../src/components/GradientButton';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pendente',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    icon: 'time-outline' as const,
    description: 'Envie seus documentos para verificação',
  },
  SUBMITTED: {
    label: 'Em análise',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    icon: 'hourglass-outline' as const,
    description: 'Seus documentos estão sendo analisados',
  },
  APPROVED: {
    label: 'Aprovado',
    color: 'text-success',
    bgColor: 'bg-success/10',
    icon: 'checkmark-circle-outline' as const,
    description: 'Sua verificação foi aprovada!',
  },
  REJECTED: {
    label: 'Rejeitado',
    color: 'text-danger',
    bgColor: 'bg-danger/10',
    icon: 'close-circle-outline' as const,
    description: 'Sua verificação foi rejeitada',
  },
};

type DocumentType = 'document_front' | 'document_back' | 'selfie' | 'criminal_record';
type UploadMime = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Official page to issue the federal criminal-record certificate (free, online). */
const GOV_CERTIDAO_URL = 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais';

interface UploadingState {
  document_front: boolean;
  document_back: boolean;
  selfie: boolean;
  criminal_record: boolean;
}

export default function KYCScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.kyc.getStatus.useQuery();
  const getUploadUrl = trpc.kyc.getUploadUrl.useMutation();
  const confirmUpload = trpc.kyc.confirmUpload.useMutation();
  const submit = trpc.kyc.submit.useMutation();

  const [uploading, setUploading] = useState<UploadingState>({
    document_front: false,
    document_back: false,
    selfie: false,
    criminal_record: false,
  });

  const [localImages, setLocalImages] = useState<Record<DocumentType, string | null>>({
    document_front: null,
    document_back: null,
    selfie: null,
    criminal_record: null,
  });
  /** File name of a PDF certificate picked in this session (no image preview). */
  const [certificatePdf, setCertificatePdf] = useState<string | null>(null);

  const kycStatus = status?.status || 'PENDING';
  const config = STATUS_CONFIG[kycStatus as keyof typeof STATUS_CONFIG];

  const canEdit = kycStatus === 'PENDING' || kycStatus === 'REJECTED';

  const pickImage = async (type: DocumentType, useCamera: boolean) => {
    if (!canEdit) return;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      // A certificate is a full page: no forced crop
      allowsEditing: type !== 'criminal_record',
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    };

    let result;
    if (useCamera) {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar fotos.');
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para selecionar fotos.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await uploadDocument(type, asset.uri, asset.mimeType || 'image/jpeg');
  };

  const pickPdf = async () => {
    if (!canEdit) return;
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    if (file.size && file.size > 5 * 1024 * 1024) {
      Alert.alert('Arquivo muito grande', 'O PDF precisa ter até 5 MB.');
      return;
    }
    const ok = await uploadDocument('criminal_record', file.uri, 'application/pdf');
    if (ok) setCertificatePdf(file.name ?? 'certidao.pdf');
  };

  const uploadDocument = async (type: DocumentType, uri: string, mimeType: string): Promise<boolean> => {
    setUploading((prev) => ({ ...prev, [type]: true }));

    try {
      // Get signed upload URL
      const { uploadUrl, path } = await getUploadUrl.mutateAsync({
        type,
        contentType: (mimeType === 'image/png' || mimeType === 'application/pdf' ? mimeType : 'image/jpeg') as UploadMime,
      });

      // Upload to Supabase Storage using signed URL
      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Confirm upload
      await confirmUpload.mutateAsync({ type, path });

      // Update local state (PDFs have no image preview)
      if (mimeType !== 'application/pdf') {
        setLocalImages((prev) => ({ ...prev, [type]: uri }));
        if (type === 'criminal_record') setCertificatePdf(null);
      }

      // Refresh status
      utils.kyc.getStatus.invalidate();
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erro', 'Não foi possível enviar o documento. Tente novamente.');
      return false;
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const showImageOptions = (type: DocumentType) => {
    if (!canEdit) return;

    const labels: Record<DocumentType, string> = {
      document_front: 'Frente do documento',
      document_back: 'Verso do documento',
      selfie: 'Selfie',
      criminal_record: 'Certidão de antecedentes',
    };

    if (type === 'criminal_record') {
      Alert.alert(labels[type], 'Envie o PDF baixado do gov.br ou uma foto nítida da certidão.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Arquivo PDF', onPress: pickPdf },
        { text: 'Foto da galeria', onPress: () => pickImage(type, false) },
        { text: 'Tirar foto', onPress: () => pickImage(type, true) },
      ]);
      return;
    }

    Alert.alert(labels[type], 'Como deseja enviar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: () => pickImage(type, false) },
      { text: 'Câmera', onPress: () => pickImage(type, true) },
    ]);
  };

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync();
      utils.kyc.getStatus.invalidate();
      utils.profiles.getMe.invalidate();
      Alert.alert('Enviado!', 'Seus documentos foram enviados para análise.');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar.');
    }
  };

  const canSubmit =
    canEdit &&
    (status?.steps?.document || localImages.document_front) &&
    (status?.steps?.selfie || localImages.selfie) &&
    (status?.steps?.criminalRecord || localImages.criminal_record || certificatePdf);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Verificação de identidade',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
      >
        {/* Status Card */}
        <View className={`${config.bgColor} rounded-card p-4 mb-6`}>
          <View className="flex-row items-center mb-2">
            <Ionicons name={config.icon} size={24} color="#041E42" />
            <Text className={`${config.color} font-bold text-lg ml-2`}>
              {config.label}
            </Text>
          </View>
          <Text className="text-ink-muted">{config.description}</Text>
          {kycStatus === 'REJECTED' && status?.rejectReason && (
            <View className="mt-3 p-3 bg-danger/5 rounded-button">
              <Text className="text-danger text-sm">
                Motivo: {status.rejectReason}
              </Text>
            </View>
          )}
        </View>

        {/* Document Upload Cards */}
        <Text className="text-ink font-bold text-lg mb-4">Documentos</Text>

        {/* Document Front */}
        <DocumentUploadCard
          title="Frente do documento"
          description="RG, CNH ou outro documento com foto"
          required
          completed={!!status?.steps?.document || !!localImages.document_front}
          uploading={uploading.document_front}
          imageUri={localImages.document_front}
          onPress={() => showImageOptions('document_front')}
          disabled={!canEdit}
        />

        {/* Document Back */}
        <DocumentUploadCard
          title="Verso do documento"
          description="Opcional, mas recomendado"
          required={false}
          completed={!!localImages.document_back}
          uploading={uploading.document_back}
          imageUri={localImages.document_back}
          onPress={() => showImageOptions('document_back')}
          disabled={!canEdit}
        />

        {/* Selfie */}
        <DocumentUploadCard
          title="Selfie com documento"
          description="Tire uma foto segurando seu documento"
          required
          completed={!!status?.steps?.selfie || !!localImages.selfie}
          uploading={uploading.selfie}
          imageUri={localImages.selfie}
          onPress={() => showImageOptions('selfie')}
          disabled={!canEdit}
        />

        {/* Criminal record certificate */}
        <Text className="text-ink font-bold text-lg mb-2 mt-2">Antecedentes criminais</Text>
        <Text className="text-ink-muted text-sm mb-4">
          Para a segurança de quem contrata, todo profissional precisa enviar a certidão de antecedentes criminais.
          Ela é gratuita e sai na hora pelo gov.br.
        </Text>

        <Pressable
          onPress={() => Linking.openURL(GOV_CERTIDAO_URL)}
          accessibilityRole="link"
          className="flex-row items-center bg-[#041E42] rounded-card p-4 mb-4"
        >
          <View className="w-10 h-10 rounded-full bg-white/15 items-center justify-center">
            <Ionicons name="document-text-outline" size={22} color="#fff" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-bold">Emitir certidão no gov.br</Text>
            <Text className="text-white/75 text-xs mt-0.5">Polícia Federal · grátis · baixe o PDF e volte aqui</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#FF6A00" />
        </Pressable>

        <DocumentUploadCard
          title="Certidão de antecedentes criminais"
          description={certificatePdf ? `PDF enviado: ${certificatePdf}` : 'PDF do gov.br ou foto nítida, emitida há até 90 dias'}
          required
          completed={!!status?.steps?.criminalRecord || !!localImages.criminal_record || !!certificatePdf}
          uploading={uploading.criminal_record}
          imageUri={localImages.criminal_record}
          onPress={() => showImageOptions('criminal_record')}
          disabled={!canEdit}
          icon="document-attach-outline"
        />

        {/* Tips */}
        <View className="bg-surface border border-border rounded-card p-4 mt-6">
          <Text className="text-ink font-medium mb-3">Dicas para aprovação</Text>
          <Tip icon="sunny-outline" text="Tire fotos em ambiente bem iluminado" />
          <Tip icon="scan-outline" text="Enquadre o documento inteiro na foto" />
          <Tip icon="eye-outline" text="Certifique-se que os dados estão legíveis" />
          <Tip icon="person-outline" text="Na selfie, segure o documento ao lado do rosto" />
          <Tip icon="shield-checkmark-outline" text="A certidão precisa estar no mesmo nome e CPF do documento" />
        </View>
      </ScrollView>

      {/* Submit Button */}
      {canEdit && (
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-8">
          <GradientButton
            label="Enviar para análise"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submit.isPending}
            icon="cloud-upload-outline"
          />
        </View>
      )}
    </>
  );
}

function DocumentUploadCard({
  title,
  description,
  required,
  completed,
  uploading,
  imageUri,
  onPress,
  disabled,
  icon = 'camera-outline',
}: {
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  uploading: boolean;
  imageUri: string | null;
  onPress: () => void;
  disabled: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || uploading}
      className={`bg-surface border rounded-card p-4 mb-4 ${
        completed ? 'border-success' : 'border-border'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-ink font-medium">{title}</Text>
            {required && <Text className="text-danger ml-1">*</Text>}
          </View>
          <Text className="text-ink-muted text-sm">{description}</Text>
        </View>

        <View className="ml-4">
          {uploading ? (
            <ActivityIndicator color="#FF6A00" />
          ) : completed ? (
            <View className="w-10 h-10 bg-success/10 rounded-full items-center justify-center">
              <Ionicons name="checkmark" size={24} color="#0E9F6E" />
            </View>
          ) : (
            <View className="w-10 h-10 bg-accent/10 rounded-full items-center justify-center">
              <Ionicons name={icon} size={24} color="#FF6A00" />
            </View>
          )}
        </View>
      </View>

      {imageUri && (
        <View className="mt-3">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-32 rounded-button"
            resizeMode="cover"
          />
        </View>
      )}
    </Pressable>
  );
}

function Tip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center mb-2 last:mb-0">
      <Ionicons name={icon} size={16} color="#5F6B7E" />
      <Text className="text-ink-muted text-sm ml-2">{text}</Text>
    </View>
  );
}
