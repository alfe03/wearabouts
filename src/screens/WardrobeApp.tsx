import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  colorToSwatch,
  countItemsByWardrobe,
  formatDateTime,
} from "@/lib/data-utils";
import {
  createClothingItemRecord,
  createWardrobeRecord,
  deleteClothingItemRecord,
  listClothingItems,
  listWardrobes,
  updateClothingItemRecord,
} from "@/lib/storage/database";
import { clothingCategories } from "@/lib/types";
import type { ClothingCategory, ClothingItem, Wardrobe } from "@/lib/types";
import {
  clothingItemFormSchema,
  type FieldErrors,
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
  const [wardrobes, setWardrobes] = useState<Wardrobe[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [wardrobeRecords, itemRecords] = await Promise.all([
        listWardrobes(),
        listClothingItems(),
      ]);
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

  async function saveWardrobe(input: { name: string; description?: string }) {
    const wardrobe = await createWardrobeRecord(input);
    await loadData();
    setScreen({
      name: "wardrobeDetail",
      wardrobeId: wardrobe.id,
      notice: "Gardırop oluşturuldu.",
    });
  }

  async function saveClothingItem(input: {
    wardrobeId: string;
    name: string;
    category: ClothingCategory;
    type: string;
    primaryColor: string;
    brand?: string;
    notes?: string;
  }) {
    const item = await createClothingItemRecord(input);
    await loadData();
    setScreen({
      name: "wardrobeDetail",
      wardrobeId: item.wardrobeId,
      notice: "Kıyafet kaydedildi.",
    });
  }

  async function updateClothingItem(
    itemId: string,
    input: {
      wardrobeId: string;
      name: string;
      category: ClothingCategory;
      type: string;
      primaryColor: string;
      brand?: string;
      notes?: string;
    },
  ) {
    const item = await updateClothingItemRecord(itemId, input);
    await loadData();
    setScreen({
      name: "itemDetail",
      itemId: item.id,
      notice: "Kıyafet güncellendi.",
    });
  }

  async function deleteItem(item: ClothingItem) {
    await deleteClothingItemRecord(item.id);
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

function HomeScreen({
  wardrobes,
  items,
  itemCounts,
  onCreateWardrobe,
  onOpenWardrobe,
}: {
  wardrobes: Wardrobe[];
  items: ClothingItem[];
  itemCounts: Map<string, number>;
  onCreateWardrobe: () => void;
  onOpenWardrobe: (wardrobeId: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
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
      <ScrollView contentContainerStyle={styles.screen}>
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
    <ScrollView contentContainerStyle={styles.screen}>
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
        <Text style={styles.sectionTitle}>Bu gardıroptaki kıyafetler</Text>
        <Text style={styles.smallText}>{items.length} kayıt</Text>
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
              <Text style={styles.eyebrow}>{item.category}</Text>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardText}>Tür: {item.type}</Text>
              <Text style={styles.cardText}>Marka: {item.brand ?? "Belirtilmedi"}</Text>
              <ColorRow color={item.primaryColor} />
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
  onSave?: (input: {
    wardrobeId: string;
    name: string;
    category: ClothingCategory;
    type: string;
    primaryColor: string;
    brand?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdate?: (input: {
    wardrobeId: string;
    name: string;
    category: ClothingCategory;
    type: string;
    primaryColor: string;
    brand?: string;
    notes?: string;
  }) => Promise<void>;
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<Key extends keyof ClothingFormState>(
    key: Key,
    value: ClothingFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
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
      if (mode === "edit" && onUpdate) {
        await onUpdate(result.data);
      } else if (onSave) {
        await onSave(result.data);
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
      <ScrollView contentContainerStyle={styles.screen}>
        <BackButton label="Geri dön" onPress={onCancel} />
        <Text style={styles.eyebrow}>
          {mode === "edit" ? "Kıyafet düzenleme" : "Manuel kayıt"}
        </Text>
        <Text style={styles.title}>
          {mode === "edit" ? "Kıyafet bilgilerini düzenle" : "Kıyafet ekle"}
        </Text>
        <Text style={styles.description}>
          Kayıtlar manuel eklenir ve bu iPhone üzerinde kalıcı olarak saklanır.
        </Text>

        {formError ? <StatusMessage tone="error" text={formError} /> : null}
        {mode === "edit" ? (
          <StatusMessage
            tone="info"
            text="Gardırop seçimini değiştirerek kıyafeti başka bir gardıroba taşıyabilirsiniz."
          />
        ) : null}

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
    <ScrollView contentContainerStyle={styles.screen}>
      <BackButton label="Gardıroba dön" onPress={onBack} />
      <Text style={styles.eyebrow}>Kıyafet detayı</Text>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.description}>
        {wardrobe?.name ?? "Gardırop bulunamadı"}
      </Text>

      {notice ? <StatusMessage tone="success" text={notice} /> : null}

      <View style={styles.actions}>
        <SecondaryButton label="Düzenle" onPress={onEdit} />
        <DangerButton
          disabled={isDeleting}
          label={isDeleting ? "Siliniyor..." : "Sil"}
          onPress={confirmDelete}
        />
      </View>

      <View style={styles.detailGrid}>
        <Detail label="Ana kategori" value={item.category} />
        <Detail label="Tür" value={item.type} />
        <Detail label="Ana renk" value={item.primaryColor} />
        <Detail label="Marka" value={item.brand ?? "Marka belirtilmedi"} />
        <Detail label="Not" value={item.notes ?? "Not eklenmedi"} />
        <Detail
          label="Veri kaynağı"
          value={item.dataSource === "manual" ? "Manuel" : "AI"}
        />
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
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
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
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
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
    gap: 8,
    padding: 16,
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
    fontSize: 18,
    fontWeight: "700",
  },
  centerPanel: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    maxWidth: 430,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  detailGrid: {
    gap: 10,
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
  safeArea: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
    gap: 16,
    maxWidth: 430,
    padding: 18,
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
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
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
  title: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 39,
  },
});
