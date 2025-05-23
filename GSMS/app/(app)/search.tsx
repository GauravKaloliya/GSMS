import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Mock local data
const MOCK_DATA = [
  { id: '1', name: 'John Doe' },
  { id: '2', name: 'Jane Smith' },
  { id: '3', name: 'Class 101' },
  { id: '4', name: 'Physics Group' },
  { id: '5', name: 'Emily Johnson' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<any[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered([]);
      return;
    }

    const q = query.toLowerCase();
    const results = MOCK_DATA.filter((item) => item.name.toLowerCase().includes(q));
    setFiltered(results);
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#eee" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Search for users"
              placeholderTextColor="#eee"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {query !== '' && (
              <Ionicons
                name="close-circle"
                size={20}
                color="#eee"
                style={styles.clearIcon}
                onPress={() => setQuery('')}
              />
            )}
          </View>

          {/* Results */}
          <View style={styles.results}>
            {query.trim() === '' ? (
              <Text style={styles.placeholderText}>Start typing to search...</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.placeholderText}>No results found</Text>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultText}>{item.name}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#eee',
  },
  clearIcon: {
    marginLeft: 8,
  },  
  results: {
    flex: 1,
    marginTop: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#eee',
    textAlign: 'center',
    marginTop: 40,
  },
  resultItem: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginVertical: 6,
  },
  resultText: {
    color: '#eee',
    fontSize: 16,
  },
});