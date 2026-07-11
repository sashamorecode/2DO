import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Tag } from '../../services/tags.api';

interface Props {
  tag: Tag;
}

export function TagChip({ tag }: Props) {
  return (
    <View style={[styles.chip, { borderColor: tag.color, backgroundColor: `${tag.color}26` }]}>
      <Text style={[styles.text, { color: tag.color }]} numberOfLines={1}>
        {tag.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 140,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
