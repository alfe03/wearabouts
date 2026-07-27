import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { analyzeClothingPhoto } from "@/lib/clothing-analysis";
import {
  colorToSwatch,
  countItemsByWardrobe,
  formatDateTime,
} from "@/lib/data-utils";
import { persistClothingPhoto } from "@/lib/photo-storage";
import {
  clearLocalUserSession,
  getLocalUserSession,
  registerLocalUserSession,
  signInLocalUserSession,
} from "@/lib/storage/user-session";
import {
  createClothingItemRecord,
  createWardrobeRecord,
  deleteClothingItemRecord,
  listClothingItems,
  listWardrobes,
  updateClothingItemRecord,
} from "@/lib/storage/database";
import { clothingCategories } from "@/lib/types";
import type {
  ClothingCategory,
  ClothingDataSource,
  ClothingImageInfo,
  ClothingItem,
  ClothingItemInput,
  LocalUser,
  LocalUserLoginInput,
  LocalUserRegistrationInput,
  Wardrobe,
} from "@/lib/types";
import {
  clothingItemFormSchema,
  type FieldErrors,
  localUserLoginFormSchema,
  localUserRegistrationFormSchema,
  wardrobeFormSchema,
  zodIssuesToFieldErrors,
} from "@/lib/validation";

type Screen =
  | { name: "home" }
  | { name: "newWardrobe" }
  | { name: "wardrobeDetail"; wardrobeId: string; notice?: string }
  | { name: "newItem"; wardrobeId?: string }
  | { name: "itemDetail"; itemId: string; notice?: string }
  | { name: "editItem"; itemId: string };

type ClothingFormState = {
  wardrobeId: string;
  name: string;
  category: "" | ClothingCategory;
  type: string;
  primaryColor: string;
  brand: string;
  notes: string;
};

type ClothingFormInput = Omit<ClothingItemInput, "userId">;

const emptyClothingForm: ClothingFormState = {
  wardrobeId: "",
  name: "",
  category: "",
  type: "",
  primaryColor: "",
  brand: "",
  notes: "",
};

export function WardrobeApp() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [user, setUser] = useState<LocalUser | undefined>();
  const [wardrobes, setWardrobes] = useState<Wardrobe[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const userRecord = await getLocalUserSession();
      const [wardrobeRecords, itemRecords] = userRecord
        ? await Promise.all([
            listWardrobes(userRecord.id),
            listClothingItems(userRecord.id),
          ])
        : [[], []];
      setUser(userRecord);
      setWardrobes(wardrobeRecords);
      setItems(itemRecords);
      setLoadError(null);
    } catch {
      setLoadError("Yerel veriler okunamadı. Lütfen uygulamayı yeniden açın.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadData]);

  const itemCounts = useMemo(() => countItemsByWardrobe(items), [items]);

  function requireSignedInUser() {
    if (!user) {
      throw new Error("Kullanıcı oturumu bulunamadı.");
    }

    return user;
  }

  async function signIn(input: LocalUserLoginInput) {
    const nextUser = await signInLocalUserSession(input);
    setUser(nextUser);
    setScreen({ name: "home" });
    setIsLoading(true);
    await loadData();
  }

  async function register(input: LocalUserRegistrationInput) {
    const nextUser = await registerLocalUserSession(input);
    setUser(nextUser);
    setScreen({ name: "home" });
    setIsLoading(true);
    await loadData();
  }

  async function signOut() {
    await clearLocalUserSession();
    setUser(undefined);
    setWardrobes([]);
    setItems([]);
    setScreen({ name: "home" });
  }

  async function saveWardrobe(input: { name: string; description?: string }) {
    const currentUser = requireSignedInUser();
    const wardrobe = await createWardrobeRecord({ ...input, userId: currentUser.id });
    await loadData();
    setScreen({
      name: "wardrobeDetail",
      wardrobeId: wardrobe.id,
      notice: "Gardırop oluşturuldu.",
    });
  }

  async function saveClothingItem(input: ClothingFormInput) {
    const currentUser = requireSignedInUser();
    const item = await createClothingItemRecord({
      ...input,
      userId: currentUser.id,
    });
    await loadData();
    setScreen({
      name: "wardrobeDetail",
      wardrobeId: item.wardrobeId,
      notice: "Kıyafet kaydedildi.",
    });
  }

  async function updateClothingItem(
    itemId: string,
    input: ClothingFormInput,
  ) {
    const currentUser = requireSignedInUser();
    const item = await updateClothingItemRecord(itemId, {
      ...input,
      userId: currentUser.id,
    });
    await loadData();
    setScreen({
      name: "itemDetail",
      itemId: item.id,
      notice: "Kıyafet güncellendi.",
    });
  }

  async function deleteItem(item: ClothingItem) {
    const currentUser = requireSignedInUser();
    await deleteClothingItemRecord(currentUser.id, item.id);
    await loadData();
    setScreen({
      name: "wardrobeDetail",
      wardrobeId: item.wardrobeId,
      notice: "Kıyafet silindi.",
    });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.mutedText}>Gardırop yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <StatusMessage tone="error" text={loadError} />
          <Button label="Tekrar dene" onPress={loadData} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoginScreen onRegister={register} onSignIn={signIn} />
      </SafeAreaView>
    );
  }

  const activeWardrobe =
    "wardrobeId" in screen
      ? wardrobes.find((wardrobe) => wardrobe.id === screen.wardrobeId)
      : undefined;
  const activeItem =
    "itemId" in screen ? items.find((item) => item.id === screen.itemId) : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen.name === "home" ? (
        <HomeScreen
          itemCounts={itemCounts}
          items={items}
          onCreateWardrobe={() => setScreen({ name: "newWardrobe" })}
          onOpenWardrobe={(wardrobeId) =>
            setScreen({ name: "wardrobeDetail", wardrobeId })
          }
          onSignOut={() => {
            void signOut();
          }}
          user={user}
          wardrobes={wardrobes}
        />
      ) : null}

      {screen.name === "newWardrobe" ? (
        <WardrobeFormScreen
          onCancel={() => setScreen({ name: "home" })}
          onSave={saveWardrobe}
        />
      ) : null}

      {screen.name === "wardrobeDetail" && activeWardrobe ? (
        <WardrobeDetailScreen
          items={items.filter((item) => item.wardrobeId === activeWardrobe.id)}
          notice={screen.notice}
          onBack={() => setScreen({ name: "home" })}
          onCreateItem={() =>
            setScreen({ name: "newItem", wardrobeId: activeWardrobe.id })
          }
          onOpenItem={(itemId) => setScreen({ name: "itemDetail", itemId })}
          wardrobe={activeWardrobe}
        />
      ) : null}

      {screen.name === "newItem" ? (
        <ClothingFormScreen
          initialWardrobeId={screen.wardrobeId}
          mode="create"
          onCancel={() =>
            setScreen(
              screen.wardrobeId
                ? { name: "wardrobeDetail", wardrobeId: screen.wardrobeId }
                : { name: "home" },
            )
          }
          onSave={saveClothingItem}
          wardrobes={wardrobes}
        />
      ) : null}

      {screen.name === "itemDetail" && activeItem ? (
        <ItemDetailScreen
          item={activeItem}
          notice={screen.notice}
          onBack={() =>
            setScreen({ name: "wardrobeDetail", wardrobeId: activeItem.wardrobeId })
          }
          onDelete={deleteItem}
          onEdit={() => setScreen({ name: "editItem", itemId: activeItem.id })}
          wardrobe={wardrobes.find(
            (wardrobe) => wardrobe.id === activeItem.wardrobeId,
          )}
        />
      ) : null}

      {screen.name === "editItem" && activeItem ? (
        <ClothingFormScreen
          existingItem={activeItem}
          mode="edit"
          onCancel={() => setScreen({ name: "itemDetail", itemId: activeItem.id })}
          onUpdate={(input) => updateClothingItem(activeItem.id, input)}
          wardrobes={wardrobes}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LoginScreen({
  onSignIn,
  onRegister,
}: {
  onSignIn: (input: LocalUserLoginInput) => Promise<void>;
  onRegister: (input: LocalUserRegistrationInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function submit() {
    setErrors({});
    setFormError(null);
    setIsSigningIn(true);

    try {
      if (mode === "login") {
        const result = localUserLoginFormSchema.safeParse({ email, password });

        if (!result.success) {
          setErrors(zodIssuesToFieldErrors(result.error));
          setIsSigningIn(false);
          return;
        }

        await onSignIn(result.data);
      } else {
        const result = localUserRegistrationFormSchema.safeParse({
          name,
          email,
          password,
          passwordConfirmation,
        });

        if (!result.success) {
          setErrors(zodIssuesToFieldErrors(result.error));
          setIsSigningIn(false);
          return;
        }

        await onRegister(result.data);
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
      );
      setIsSigningIn(false);
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setErrors({});
    setFormError(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
        <View style={styles.loginHero}>
          <Text style={styles.eyebrow}>Yerel profil</Text>
          <Text style={styles.title}>Dijital Gardırop</Text>
          <Text style={styles.description}>
            Her profil kendi gardıroplarını bu cihazda ayrı tutar.
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          <SegmentButton
            label="Giriş"
            onPress={() => switchMode("login")}
            selected={mode === "login"}
          />
          <SegmentButton
            label="Yeni profil"
            onPress={() => switchMode("register")}
            selected={mode === "register"}
          />
        </View>

        {formError ? <StatusMessage tone="error" text={formError} /> : null}

        {mode === "register" ? (
          <Field
            error={errors.name}
            label="Ad"
            onChangeText={setName}
            placeholder="Cemil"
            value={name}
          />
        ) : null}
        <Field
          autoCapitalize="none"
          error={errors.email}
          keyboardType="email-address"
          label="E-posta"
          onChangeText={setEmail}
          placeholder="cemil@example.com"
          value={email}
        />
        <Field
          autoCapitalize="none"
          error={errors.password}
          label="Şifre"
          onChangeText={setPassword}
          placeholder="En az 6 karakter"
          secureTextEntry
          value={password}
        />
        {mode === "register" ? (
          <Field
            autoCapitalize="none"
            error={errors.passwordConfirmation}
            label="Şifre tekrar"
            onChangeText={setPasswordConfirmation}
            placeholder="Şifrenizi tekrar girin"
            secureTextEntry
            value={passwordConfirmation}
          />
        ) : null}

        <Button
          disabled={isSigningIn}
          label={
            isSigningIn
              ? "İşleniyor..."
              : mode === "login"
                ? "Giriş yap"
                : "Profili oluştur"
          }
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeScreen({
  wardrobes,
  items,
  itemCounts,
  user,
  onCreateWardrobe,
  onOpenWardrobe,
  onSignOut,
}: {
  wardrobes: Wardrobe[];
  items: ClothingItem[];
  itemCounts: Map<string, number>;
  user: LocalUser;
  onCreateWardrobe: () => void;
  onOpenWardrobe: (wardrobeId: string) => void;
  onSignOut: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
      <View style={styles.userBar}>
        <View style={styles.flex}>
          <Text style={styles.smallText}>Oturum</Text>
          <Text style={styles.userName}>{user.name}</Text>
        </View>
        <SecondaryButton label="Çıkış" onPress={onSignOut} />
      </View>

      <Text style={styles.eyebrow}>Kişisel takip</Text>
      <Text style={styles.title}>Dijital Gardırop</Text>
      <Text style={styles.description}>
        Kıyafet ve ayakkabılarınızı fiziksel gardıroplara göre bu cihazda
        düzenleyin.
      </Text>

      <View style={styles.metricsRow}>
        <Metric label="Gardırop" value={wardrobes.length} />
        <Metric label="Kıyafet" value={items.length} />
      </View>

      <Button label="Yeni gardırop oluştur" onPress={onCreateWardrobe} />

      <Text style={styles.sectionTitle}>Gardıroplar</Text>

      {wardrobes.length === 0 ? (
        <EmptyState
          actionLabel="İlk gardırobu oluştur"
          onAction={onCreateWardrobe}
          text="Ev, yazlık veya kışlık dolap gibi fiziksel alanlar oluşturarak başlayın."
          title="Henüz gardırop yok"
        />
      ) : (
        <View style={styles.list}>
          {wardrobes.map((wardrobe) => (
            <Pressable
              accessibilityRole="button"
              key={wardrobe.id}
              onPress={() => onOpenWardrobe(wardrobe.id)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{wardrobe.name}</Text>
                  <Text style={styles.cardText}>
                    {wardrobe.description ?? "Açıklama eklenmedi."}
                  </Text>
                </View>
                <Text style={styles.countBadge}>
                  {itemCounts.get(wardrobe.id) ?? 0}
                </Text>
              </View>
              <Text style={styles.smallText}>
                Oluşturulma: {formatDateTime(wardrobe.createdAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function WardrobeFormScreen({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: { name: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const result = wardrobeFormSchema.safeParse({ name, description });

    if (!result.success) {
      setErrors(zodIssuesToFieldErrors(result.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setIsSaving(true);

    try {
      await onSave(result.data);
    } catch {
      setFormError("Gardırop kaydedilemedi. Lütfen tekrar deneyin.");
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
        <BackButton label="Ana sayfaya dön" onPress={onCancel} />
        <Text style={styles.eyebrow}>Yeni kayıt</Text>
        <Text style={styles.title}>Gardırop oluştur</Text>
        <Text style={styles.description}>
          Ev Gardırobu, Yazlık Gardırop veya Kışlık Dolap gibi fiziksel bir
          alan tanımlayın.
        </Text>

        {formError ? <StatusMessage tone="error" text={formError} /> : null}

        <Field
          error={errors.name}
          label="Gardırop adı"
          onChangeText={setName}
          placeholder="Ev Gardırobu"
          value={name}
        />
        <Field
          label="Açıklama"
          multiline
          onChangeText={setDescription}
          placeholder="Günlük kullanım, mevsimlik dolap veya konum bilgisi"
          value={description}
        />

        <View style={styles.actions}>
          <SecondaryButton label="İptal" onPress={onCancel} />
          <Button
            disabled={isSaving}
            label={isSaving ? "Kaydediliyor..." : "Gardırobu kaydet"}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function WardrobeDetailScreen({
  wardrobe,
  items,
  notice,
  onBack,
  onCreateItem,
  onOpenItem,
}: {
  wardrobe: Wardrobe;
  items: ClothingItem[];
  notice?: string;
  onBack: () => void;
  onCreateItem: () => void;
  onOpenItem: (itemId: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
      <BackButton label="Tüm gardıroplar" onPress={onBack} />
      <Text style={styles.eyebrow}>Gardırop detayı</Text>
      <Text style={styles.title}>{wardrobe.name}</Text>
      <Text style={styles.description}>
        {wardrobe.description ?? "Açıklama eklenmedi."}
      </Text>
      <Text style={styles.smallText}>
        Güncelleme: {formatDateTime(wardrobe.updatedAt)}
      </Text>

      {notice ? <StatusMessage tone="success" text={notice} /> : null}

      <Button label="Kıyafet ekle" onPress={onCreateItem} />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.flex]}>
          Bu gardıroptaki kıyafetler
        </Text>
        <Text style={styles.countText}>{items.length} kayıt</Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          actionLabel="Kıyafet ekle"
          onAction={onCreateItem}
          text="Bu gardıroba manuel olarak ilk kıyafetinizi ekleyebilirsiniz."
          title="Henüz kıyafet yok"
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => onOpenItem(item.id)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.itemCardHeader}>
                {item.image ? (
                  <Image
                    accessibilityLabel={`${item.name} fotoğrafı`}
                    resizeMode="cover"
                    source={{ uri: item.image.uri }}
                    style={styles.thumbnail}
                  />
                ) : null}
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>{item.category}</Text>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardText}>Tür: {item.type}</Text>
                  <Text style={styles.cardText}>
                    Marka: {item.brand ?? "Belirtilmedi"}
                  </Text>
                  <ColorRow color={item.primaryColor} />
                </View>
              </View>
              <Text style={styles.linkText}>Görüntüle</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ClothingFormScreen({
  wardrobes,
  mode,
  initialWardrobeId,
  existingItem,
  onCancel,
  onSave,
  onUpdate,
}: {
  wardrobes: Wardrobe[];
  mode: "create" | "edit";
  initialWardrobeId?: string;
  existingItem?: ClothingItem;
  onCancel: () => void;
  onSave?: (input: ClothingFormInput) => Promise<void>;
  onUpdate?: (input: ClothingFormInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ClothingFormState>({
    ...emptyClothingForm,
    wardrobeId: initialWardrobeId ?? wardrobes[0]?.id ?? "",
    name: existingItem?.name ?? "",
    category: existingItem?.category ?? "",
    type: existingItem?.type ?? "",
    primaryColor: existingItem?.primaryColor ?? "",
    brand: existingItem?.brand ?? "",
    notes: existingItem?.notes ?? "",
  });
  const [photo, setPhoto] = useState<ClothingImageInfo | undefined>(
    existingItem?.image,
  );
  const [dataSource, setDataSource] = useState<ClothingDataSource>(
    existingItem?.dataSource ?? "manual",
  );
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function setField<Key extends keyof ClothingFormState>(
    key: Key,
    value: ClothingFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyAnalysisSuggestion(
    suggestion: Awaited<ReturnType<typeof analyzeClothingPhoto>>,
  ) {
    setForm((current) => ({
      ...current,
      name: suggestion.name ?? current.name,
      category: suggestion.category,
      type: suggestion.type,
      primaryColor: suggestion.primaryColor,
      brand: suggestion.brand ?? "",
      notes: current.notes || suggestion.notes || "",
    }));
    setDataSource("ai");
    setAnalysisStatus("Fotoğraf analizi forma uygulandı. Kaydetmeden önce düzenleyebilirsiniz.");
  }

  async function analyzePhoto(image: ClothingImageInfo) {
    setIsAnalyzing(true);
    setFormError(null);
    setAnalysisStatus(null);

    try {
      applyAnalysisSuggestion(await analyzeClothingPhoto(image));
    } catch (error) {
      setDataSource("manual");
      setFormError(
        error instanceof Error
          ? error.message
          : "Fotoğraf analizi tamamlanamadı. Alanları manuel doldurabilirsiniz.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function pickPhoto(source: NonNullable<ClothingImageInfo["source"]>) {
    setFormError(null);

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setFormError(
          source === "camera"
            ? "Kamera izni verilmedi. Fotoğraf çekmek için izin gerekiyor."
            : "Fotoğraf izni verilmedi. Galeriden seçim yapmak için izin gerekiyor.",
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              mediaTypes: ["images"],
              quality: 0.72,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              mediaTypes: ["images"],
              quality: 0.72,
            });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const savedPhoto = await persistClothingPhoto(result.assets[0], source);
      setPhoto(savedPhoto);
      setDataSource("manual");
      await analyzePhoto(savedPhoto);
    } catch {
      setDataSource("manual");
      setFormError("Fotoğraf alınamadı. Lütfen tekrar deneyin.");
    }
  }

  async function submit() {
    const result = clothingItemFormSchema.safeParse(form);

    if (!result.success) {
      setErrors(zodIssuesToFieldErrors(result.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setIsSaving(true);

    try {
      const input: ClothingFormInput = {
        ...result.data,
        dataSource,
        image: photo,
      };

      if (mode === "edit" && onUpdate) {
        await onUpdate(input);
      } else if (onSave) {
        await onSave(input);
      }
    } catch {
      setFormError("Kıyafet kaydedilemedi. Lütfen tekrar deneyin.");
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
        <BackButton label="Geri dön" onPress={onCancel} />
        <Text style={styles.eyebrow}>
          {mode === "edit" ? "Kıyafet düzenleme" : "Manuel kayıt"}
        </Text>
        <Text style={styles.title}>
          {mode === "edit" ? "Kıyafet bilgilerini düzenle" : "Kıyafet ekle"}
        </Text>
        <Text style={styles.description}>
          Fotoğrafla analiz alabilir veya alanları doğrudan doldurabilirsiniz.
        </Text>

        {formError ? <StatusMessage tone="error" text={formError} /> : null}
        {mode === "edit" ? (
          <StatusMessage
            tone="info"
            text="Gardırop seçimini değiştirerek kıyafeti başka bir gardıroba taşıyabilirsiniz."
          />
        ) : null}
        {analysisStatus ? <StatusMessage tone="success" text={analysisStatus} /> : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Fotoğraf</Text>
          <View style={styles.photoActions}>
            <View style={styles.horizontalActionItem}>
              <SecondaryButton
                disabled={isAnalyzing || isSaving}
                label="Kamerayla çek"
                onPress={() => {
                  void pickPhoto("camera");
                }}
              />
            </View>
            <View style={styles.horizontalActionItem}>
              <SecondaryButton
                disabled={isAnalyzing || isSaving}
                label="Galeriden seç"
                onPress={() => {
                  void pickPhoto("upload");
                }}
              />
            </View>
          </View>
          {photo ? (
            <View style={styles.photoPreviewPanel}>
              <Image
                accessibilityLabel="Seçilen kıyafet fotoğrafı"
                resizeMode="cover"
                source={{ uri: photo.uri }}
                style={styles.photoPreview}
              />
              <SecondaryButton
                disabled={isAnalyzing || isSaving}
                label={isAnalyzing ? "Analiz ediliyor..." : "Tekrar analiz et"}
                onPress={() => {
                  void analyzePhoto(photo);
                }}
              />
            </View>
          ) : null}
        </View>

        <Field
          error={errors.name}
          label="Kıyafet adı"
          onChangeText={(value) => setField("name", value)}
          placeholder="Beyaz Oxford gömlek"
          value={form.name}
        />

        <Text style={styles.fieldLabel}>Ana kategori</Text>
        <View style={styles.chipGrid}>
          {clothingCategories.map((category) => (
            <ChoiceChip
              key={category}
              label={category}
              onPress={() => setField("category", category)}
              selected={form.category === category}
            />
          ))}
        </View>
        {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

        <Field
          error={errors.type}
          label="Tür"
          onChangeText={(value) => setField("type", value)}
          placeholder="Gömlek"
          value={form.type}
        />
        <Field
          error={errors.primaryColor}
          label="Ana renk"
          onChangeText={(value) => setField("primaryColor", value)}
          placeholder="Beyaz"
          value={form.primaryColor}
        />
        <Field
          label="Marka"
          onChangeText={(value) => setField("brand", value)}
          placeholder="Mavi"
          value={form.brand}
        />

        <Text style={styles.fieldLabel}>Bulunduğu gardırop</Text>
        <View style={styles.list}>
          {wardrobes.map((wardrobe) => (
            <ChoiceRow
              key={wardrobe.id}
              label={wardrobe.name}
              onPress={() => setField("wardrobeId", wardrobe.id)}
              selected={form.wardrobeId === wardrobe.id}
            />
          ))}
        </View>
        {errors.wardrobeId ? (
          <Text style={styles.errorText}>{errors.wardrobeId}</Text>
        ) : null}

        <Field
          label="Not"
          multiline
          onChangeText={(value) => setField("notes", value)}
          placeholder="Kumaş, beden veya kullanım notu"
          value={form.notes}
        />

        <View style={styles.actions}>
          <SecondaryButton label="İptal" onPress={onCancel} />
          <Button
            disabled={isSaving}
            label={isSaving ? "Kaydediliyor..." : "Kıyafeti kaydet"}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ItemDetailScreen({
  item,
  wardrobe,
  notice,
  onBack,
  onEdit,
  onDelete,
}: {
  item: ClothingItem;
  wardrobe?: Wardrobe;
  notice?: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (item: ClothingItem) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      "Kıyafet silinsin mi?",
      `"${item.name}" kaydı silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            setIsDeleting(true);
            void onDelete(item).catch(() => {
              setIsDeleting(false);
              Alert.alert("Hata", "Kıyafet silinemedi. Lütfen tekrar deneyin.");
            });
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.flex}>
      <BackButton label="Gardıroba dön" onPress={onBack} />
      <Text style={styles.eyebrow}>Kıyafet detayı</Text>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.description}>
        {wardrobe?.name ?? "Gardırop bulunamadı"}
      </Text>

      {notice ? <StatusMessage tone="success" text={notice} /> : null}
      {item.image ? (
        <Image
          accessibilityLabel={`${item.name} fotoğrafı`}
          resizeMode="cover"
          source={{ uri: item.image.uri }}
          style={styles.detailImage}
        />
      ) : null}

      <View style={styles.horizontalActions}>
        <View style={styles.horizontalActionItem}>
          <SecondaryButton label="Düzenle" onPress={onEdit} />
        </View>
        <View style={styles.horizontalActionItem}>
          <DangerButton
            disabled={isDeleting}
            label={isDeleting ? "Siliniyor..." : "Sil"}
            onPress={confirmDelete}
          />
        </View>
      </View>

      <View style={styles.detailGrid}>
        <Detail label="Ana kategori" value={item.category} />
        <Detail label="Tür" value={item.type} />
        <Detail label="Ana renk" value={item.primaryColor} />
        <Detail label="Marka" value={item.brand ?? "Marka belirtilmedi"} />
        <Detail label="Not" value={item.notes ?? "Not eklenmedi"} />
        <Detail label="Son güncelleme" value={formatDateTime(item.updatedAt)} />
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  placeholder,
  error,
  multiline,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.actionButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        styles.actionButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dangerButton,
        styles.actionButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.smallText}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
      <Button label={actionLabel} onPress={onAction} />
    </View>
  );
}

function StatusMessage({
  tone,
  text,
}: {
  tone: "success" | "error" | "info";
  text: string;
}) {
  return (
    <View style={[styles.status, styles[`${tone}Status`]]}>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.selectedChoice]}
    >
      <Text style={[styles.chipText, selected && styles.selectedChoiceText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choiceRow, selected && styles.selectedChoice]}
    >
      <Text style={[styles.choiceText, selected && styles.selectedChoiceText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.segmentButton, selected && styles.selectedSegmentButton]}
    >
      <Text style={[styles.segmentText, selected && styles.selectedSegmentText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ColorRow({ color }: { color: string }) {
  return (
    <View style={styles.colorRow}>
      <View style={[styles.swatch, { backgroundColor: colorToSwatch(color) }]} />
      <Text style={styles.cardText}>{color}</Text>
    </View>
  );
}

const colors = {
  background: "#f5f7f2",
  surface: "#ffffff",
  surfaceMuted: "#eef3ed",
  foreground: "#17211f",
  muted: "#66736f",
  border: "#d9e1dc",
  accent: "#0f766e",
  accentStrong: "#0b4f4a",
  accentSoft: "#dff3ef",
  danger: "#b42318",
  dangerSoft: "#fff5f4",
  placeholder: "#8a9692",
};

const styles = StyleSheet.create({
  actions: {
    gap: 10,
    marginTop: 6,
  },
  actionButton: {
    minWidth: 0,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingVertical: 6,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  cardTitle: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23,
  },
  centerPanel: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
    width: "100%",
  },
  chip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  choiceRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  choiceText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  colorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  countBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 34,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    textAlign: "center",
  },
  countText: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    paddingTop: 12,
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: "#f4b7b0",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  detail: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 13,
  },
  detailGrid: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  detailImage: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    width: "100%",
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
  },
  disabled: {
    opacity: 0.55,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: "#b9c8c2",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  errorStatus: {
    backgroundColor: "#fff1f0",
    borderColor: "#f4b7b0",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  horizontalActions: {
    flexDirection: "row",
    gap: 10,
  },
  horizontalActionItem: {
    flex: 1,
    minWidth: 0,
  },
  infoStatus: {
    backgroundColor: "#f7faf9",
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  list: {
    gap: 10,
  },
  loginHero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  itemCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
  },
  metric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    padding: 14,
  },
  metricValue: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  multilineInput: {
    minHeight: 96,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoPreview: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    width: "100%",
  },
  photoPreviewPanel: {
    gap: 10,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    width: "100%",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  segmentedControl: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedSegmentButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  selectedSegmentText: {
    color: colors.foreground,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: 8,
  },
  selectedChoice: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectedChoiceText: {
    color: "#ffffff",
  },
  smallText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  status: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  statusText: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  successStatus: {
    backgroundColor: "#ecfdf3",
    borderColor: "#b7e4c7",
  },
  swatch: {
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  thumbnail: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 96,
    width: 96,
  },
  title: {
    color: colors.foreground,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 37,
  },
  userBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  userName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
});
