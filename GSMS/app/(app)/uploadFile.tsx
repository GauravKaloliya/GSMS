import React, { useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function UploadFile() {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startGlow = () => {
    glowLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    glowLoopRef.current.start();
  };

  const stopGlow = () => {
    glowLoopRef.current?.stop();
    glowAnim.setValue(0);
  };

  const pickDocument = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({});
    if (!result.canceled && result.assets?.length > 0) {
      const pickedFile = result.assets[0];
      setFile(pickedFile);
      setFileContent(null);
      setLoading(true);

      const isTextFile =
        pickedFile.mimeType?.startsWith('text/') ||
        /\.(json|js|md|csv|txt|html|xml)$/i.test(pickedFile.name);

      if (isTextFile) {
        try {
          const content = await FileSystem.readAsStringAsync(pickedFile.uri);
          setFileContent(content);
        } catch {
          setError('Unable to read file content.');
        }
      }

      setLoading(false);
      setPreviewVisible(true);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      startGlow();
    } else {
      clearFile();
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileContent(null);
    setError(null);
    setLoading(false);
    setPreviewVisible(false);
    fadeAnim.setValue(0);
    stopGlow();
  };

  const openFile = async () => {
    if (file?.uri && (await Linking.canOpenURL(file.uri))) {
      await Linking.openURL(file.uri);
    } else {
      setError('Cannot open this file type on your device.');
    }
  };

  const shareFile = async () => {
    if (file?.uri && (await Sharing.isAvailableAsync())) {
      try {
        await Sharing.shareAsync(file.uri);
      } catch {
        setError('Failed to share file.');
      }
    } else {
      setError('Sharing not available on this device.');
    }
  };

  // Placeholder upload function
  const uploadFile = () => {
    alert(`Upload action triggered for file:\n${file?.name}`);
    // Replace with your upload logic
  };

  const renderFilePreview = () => {
    if (!file) return null;

    if (file.mimeType?.startsWith('image/')) {
      return <Image source={{ uri: file.uri }} style={styles.fullscreenImage} />;
    }

    if (file.mimeType?.startsWith('video/')) {
      return <MaterialIcons name="movie" size={140} color="#00aaff" style={styles.fileIcon} />;
    }

    if (file.mimeType?.startsWith('audio/')) {
      return <MaterialIcons name="audiotrack" size={140} color="#00cc88" style={styles.fileIcon} />;
    }

    if (file.mimeType === 'application/pdf') {
      return <MaterialIcons name="picture-as-pdf" size={140} color="#ff5555" style={styles.fileIcon} />;
    }

    return <MaterialIcons name="insert-drive-file" size={140} color="#aaa" style={styles.fileIcon} />;
  };

  const glowInterpolation = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(51,153,255,0.3)', 'rgba(51,153,255,0.7)'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {!file && (
        <ScrollView
          contentContainerStyle={[styles.container, { justifyContent: 'center' }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Upload Your File</Text>
          <TouchableOpacity style={styles.uploadZone} onPress={pickDocument} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={70} color="#3399ff" />
            <Text style={styles.uploadText}>Tap to Upload or Browse Files</Text>
            <View style={styles.uploadHintContainer}>
              <MaterialIcons name="info-outline" size={18} color="#7992cc" />
              <Text style={styles.uploadHint}>Supported: Images, Videos, Audio, Text</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={previewVisible} animationType="fade" transparent>
        <Animated.View
          style={[
            styles.fullscreenOverlay,
            {
              opacity: fadeAnim,
              borderColor: glowInterpolation,
            },
          ]}
        >
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={clearFile} style={styles.closeButton}>
              <Ionicons name="close-circle" size={36} color="#ff5555" />
            </TouchableOpacity>

            <View style={styles.actionIcons}>
              <TouchableOpacity onPress={openFile} style={styles.actionButton}>
                <MaterialIcons name="folder-open" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={shareFile} style={styles.actionButton}>
                <MaterialIcons name="share" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  alert(`File: ${file?.name}\nType: ${file?.mimeType || 'Unknown'}\nSize: ${file?.size} bytes`)
                }
                style={styles.actionButton}
              >
                <MaterialIcons name="info" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.previewContent} keyboardShouldPersistTaps="handled">
            {renderFilePreview()}

            {loading && <ActivityIndicator size="large" color="#3399ff" style={{ marginVertical: 20 }} />}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {fileContent && (
              <ScrollView style={styles.fileContentContainer}>
                <Text style={styles.fileContentText}>{fileContent}</Text>
              </ScrollView>
            )}

            {/* Upload Button at bottom */}
            <TouchableOpacity style={styles.uploadButton} onPress={uploadFile} activeOpacity={0.8}>
              <Ionicons name="cloud-upload" size={26} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#eee',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#eee',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  uploadZone: {
    borderWidth: 3,
    borderColor: '#3399ff',
    borderStyle: 'dashed',
    borderRadius: 24,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#1a1a33',
  },
  uploadText: {
    fontSize: 22,
    color: '#66b3ff',
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: 0.8,
  },
  uploadHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  uploadHint: {
    fontSize: 15,
    color: '#7992cc',
    marginLeft: 8,
    fontWeight: '600',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 20,
    margin: 16,
    padding: 20
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: { padding: 8 },
  actionIcons: { flexDirection: 'row' },
  actionButton: { marginLeft: 24 },
  fullscreenImage: {
    width: '100%',
    height: 400,
    borderRadius: 20,
    resizeMode: 'contain',
  },
  fileIcon: {
    marginBottom: 24,
  },
  previewContent: {
    paddingTop: 24,
    alignItems: 'center',
  },
  fileContentContainer: {
    maxHeight: 280,
    width: '100%',
    backgroundColor: 'rgba(51, 51, 102, 0.8)',
    borderRadius: 18,
    padding: 20,
    marginTop: 20
  },
  fileContentText: {
    fontSize: 16,
    color: '#dbe1ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  uploadButton: {
    marginTop: 32,
    backgroundColor: '#3399ff',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: 0.6,
  },
});