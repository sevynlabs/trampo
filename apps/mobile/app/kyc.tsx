import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { trpc } from '../src/lib/trpc';
import { GradientButton } from '../src/components/GradientButton';

/**
 * Verification, in two layers:
 *  1. Identidade (todos): documento + selfie. Enviou → já pode publicar e contratar.
 *  2. Conta profissional (só quem ativou): certidão de antecedentes criminais.
 *     O feed e o aceite de serviços liberam quando a equipe aprova tudo.
 */

type Status = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type DocumentType = 'document_front' | 'document_back' | 'selfie' | 'criminal_record';
type UploadMime = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Official page to issue the federal criminal-record certificate (free, online). */
const GOV_CERTIDAO_URL = 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais';

const STATUS_UI: Record<Status, { label: string; fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDING: { label: 'Pendente', fg: '#B45309', bg: '#FEF3C7', icon: 'time-outline' },
  SUBMITTED: { label: 'Em análise', fg: '#0369A1', bg: '#E0F2FE', icon: 'hourglass-outline' },
  APPROVED: { label: 'Aprovado', fg: '#047857', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  REJECTED: { label: 'Reprovado', fg: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const editable = (s: Status) => s === 'PENDING' || s === 'REJECTED';

export default function KYCScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.kyc.getStatus.useQuery();
  const getUploadUrl = trpc.kyc.getUploadUrl.useMutation();
  const confirmUpload = trpc.kyc.confirmUpload.useMutation();
  const submitIdentity = trpc.kyc.submitIdentity.useMutation();
  const submitProfessional = trpc.kyc.submitProfessional.useMutation();

  const [uploading, setUploading] = useState<Record<DocumentType, boolean>>({
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

  const identityStatus = (status?.identity.status ?? 'PENDING') as Status;
  const pro = status?.professional ?? null;
  const proStatus = (pro?.status ?? 'PENDING') as Status;

  const canEditIdentity = editable(identityStatus);
  const canEditPro = !!pro && editable(proStatus);
  const identitySent = identityStatus === 'SUBMITTED' || identityStatus === 'APPROVED';

  const has = {
    front: !!status?.identity.steps.document || !!localImages.document_front,
    back: !!status?.identity.steps.documentBack || !!localImages.document_back,
    selfie: !!status?.identity.steps.selfie || !!localImages.selfie,
    certificate: !!pro?.criminalRecord || !!localImages.criminal_record || !!certificatePdf,
  };

  const canEdit = (type: DocumentType) => (type === 'criminal_record' ? canEditPro : canEditIdentity);

  const uploadDocument = async (type: DocumentType, uri: string, mimeType: string): Promise<boolean> => {
    setUploading((prev) => ({ ...prev, [type]: true }));
    try {
      const contentType = (mimeType === 'image/png' || mimeType === 'application/pdf' ? mimeType : 'image/jpeg') as UploadMime;
      const { uploadUrl, path } = await getUploadUrl.mutateAsync({ type, contentType });

      const blob = await (await fetch(uri)).blob();
      const uploadResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      await confirmUpload.mutateAsync({ type, path });

      // PDFs have no image preview
      if (contentType !== 'application/pdf') {
        setLocalImages((prev) => ({ ...prev, [type]: uri }));
        if (type === 'criminal_record') setCertificatePdf(null);
      }
      utils.kyc.getStatus.invalidate();
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erro', 'Não foi possível enviar o arquivo. Tente novamente.');
      return false;
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const pickImage = async (type: DocumentType, useCamera: boolean) => {
    if (!canEdit(type)) return;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      // A certificate is a full page: no forced crop
      allowsEditing: type !== 'criminal_record',
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    };

    let result: ImagePicker.ImagePickerResult;
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
    if (!canEditPro) return;
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

  const showOptions = (type: DocumentType) => {
    if (!canEdit(type)) return;
    if (type === 'criminal_record') {
      Alert.alert('Certidão de antecedentes', 'Envie o PDF baixado do gov.br ou uma foto nítida da certidão.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Arquivo PDF', onPress: pickPdf },
        { text: 'Foto da galeria', onPress: () => pickImage(type, false) },
        { text: 'Tirar foto', onPress: () => pickImage(type, true) },
      ]);
      return;
    }
    const labels = { document_front: 'Frente do documento', document_back: 'Verso do documento', selfie: 'Selfie' } as const;
    Alert.alert(labels[type], 'Como deseja enviar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: () => pickImage(type, false) },
      { text: 'Câmera', onPress: () => pickImage(type, true) },
    ]);
  };

  const afterSubmit = () => {
    utils.kyc.getStatus.invalidate();
    utils.profiles.getMe.invalidate();
  };

  const handleSubmitIdentity = async () => {
    try {
      await submitIdentity.mutateAsync();
      afterSubmit();
      Alert.alert(
        'Documentos enviados!',
        pro
          ? 'Agora envie a certidão de antecedentes para concluir sua conta profissional.'
          : 'Pronto! Você já pode publicar e contratar serviços. Nossa equipe vai conferir seus documentos.'
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar.');
    }
  };

  const handleSubmitPro = async () => {
    try {
      await submitProfessional.mutateAsync();
      afterSubmit();
      Alert.alert('Enviado para análise!', 'Assim que a equipe aprovar, os serviços disponíveis aparecem para você.');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar.');
    }
  };

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
          title: 'Verificação',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#041E42" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        {/* ---------------------------------------------------------- Identidade */}
        <SectionHeader
          step={1}
          title="Verificação de identidade"
          subtitle="Obrigatória para todos. Com ela enviada você já pode publicar e contratar serviços."
          status={identityStatus}
          rejectReason={status?.identity.rejectReason}
        />

        <DocumentUploadCard
          title="Frente do documento"
          description="RG, CNH ou outro documento com foto"
          required
          completed={has.front}
          uploading={uploading.document_front}
          imageUri={localImages.document_front}
          onPress={() => showOptions('document_front')}
          disabled={!canEditIdentity}
        />
        <DocumentUploadCard
          title="Verso do documento"
          description="Opcional, mas recomendado"
          required={false}
          completed={has.back}
          uploading={uploading.document_back}
          imageUri={localImages.document_back}
          onPress={() => showOptions('document_back')}
          disabled={!canEditIdentity}
        />
        <DocumentUploadCard
          title="Selfie com documento"
          description="Tire uma foto segurando seu documento ao lado do rosto"
          required
          completed={has.selfie}
          uploading={uploading.selfie}
          imageUri={localImages.selfie}
          onPress={() => showOptions('selfie')}
          disabled={!canEditIdentity}
        />

        {canEditIdentity && (
          <View className="mb-2">
            <GradientButton
              label="Enviar documentos"
              onPress={handleSubmitIdentity}
              disabled={!(has.front && has.selfie)}
              loading={submitIdentity.isPending}
              icon="cloud-upload-outline"
            />
          </View>
        )}

        {/* ---------------------------------------------------- Conta profissional */}
        {pro ? (
          <View className="mt-8">
            <SectionHeader
              step={2}
              title="Conta profissional"
              subtitle="Para a segurança de quem contrata, todo profissional envia a certidão de antecedentes criminais. Os serviços disponíveis aparecem depois da aprovação da equipe."
              status={proStatus}
              rejectReason={pro.rejectReason}
            />

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
              description={
                certificatePdf
                  ? `PDF enviado: ${certificatePdf}`
                  : pro.criminalRecord && pro.criminalRecordIsPdf
                    ? 'PDF enviado'
                    : 'PDF do gov.br ou foto nítida, emitida há até 90 dias, no mesmo nome e CPF do documento'
              }
              required
              completed={has.certificate}
              uploading={uploading.criminal_record}
              imageUri={localImages.criminal_record}
              onPress={() => showOptions('criminal_record')}
              disabled={!canEditPro}
              icon="document-attach-outline"
            />

            {canEditPro && (
              <>
                {!identitySent && (
                  <Text className="text-ink-muted text-sm mb-3">
                    Envie primeiro os documentos de identidade (etapa 1).
                  </Text>
                )}
                <GradientButton
                  label="Enviar para análise"
                  onPress={handleSubmitPro}
                  disabled={!identitySent || !has.certificate}
                  loading={submitProfessional.isPending}
                  icon="shield-checkmark-outline"
                />
              </>
            )}
          </View>
        ) : (
          <View className="mt-8 bg-surface border border-border rounded-card p-4">
            <View className="flex-row items-center mb-1">
              <Ionicons name="construct-outline" size={18} color="#FF6A00" />
              <Text className="text-ink font-bold ml-2">Quer prestar serviços?</Text>
            </View>
            <Text className="text-ink-muted text-sm">
              Mude para conta profissional em Meu perfil. Além destes documentos, será pedida a certidão de
              antecedentes criminais.
            </Text>
          </View>
        )}

        {/* Tips */}
        <View className="bg-surface border border-border rounded-card p-4 mt-8">
          <Text className="text-ink font-medium mb-3">Dicas para aprovação</Text>
          <Tip icon="sunny-outline" text="Tire fotos em ambiente bem iluminado" />
          <Tip icon="scan-outline" text="Enquadre o documento inteiro na foto" />
          <Tip icon="eye-outline" text="Certifique-se que os dados estão legíveis" />
          <Tip icon="person-outline" text="Na selfie, segure o documento ao lado do rosto" />
          {pro && <Tip icon="shield-checkmark-outline" text="A certidão precisa estar no mesmo nome e CPF do documento" />}
        </View>
      </ScrollView>
    </>
  );
}

function SectionHeader({
  step,
  title,
  subtitle,
  status,
  rejectReason,
}: {
  step: number;
  title: string;
  subtitle: string;
  status: Status;
  rejectReason?: string | null;
}) {
  const ui = STATUS_UI[status];
  return (
    <View className="mb-4">
      <View className="flex-row items-center">
        <View className="w-7 h-7 rounded-full bg-[#041E42] items-center justify-center">
          <Text className="text-white font-bold text-xs">{step}</Text>
        </View>
        <Text className="text-ink font-bold text-lg ml-2 flex-1">{title}</Text>
        <View style={{ backgroundColor: ui.bg }} className="flex-row items-center rounded-full px-2.5 py-1">
          <Ionicons name={ui.icon} size={14} color={ui.fg} />
          <Text style={{ color: ui.fg }} className="text-xs font-bold ml-1">
            {ui.label}
          </Text>
        </View>
      </View>
      <Text className="text-ink-muted text-sm mt-2">{subtitle}</Text>
      {status === 'REJECTED' && rejectReason && (
        <View className="mt-3 p-3 bg-danger/5 rounded-button">
          <Text className="text-danger text-sm">Motivo: {rejectReason}</Text>
        </View>
      )}
    </View>
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
      className={`bg-surface border rounded-card p-4 mb-4 ${completed ? 'border-success' : 'border-border'} ${
        disabled ? 'opacity-60' : ''
      }`}
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
          <Image source={{ uri: imageUri }} className="w-full h-32 rounded-button" resizeMode="cover" />
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
