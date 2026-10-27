import { PropsWithChildren, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';
import { ViewportCobwebs } from '../theme/HalloweenArtwork';

export function AppViewport({ children }: PropsWithChildren) {
  const [viewport, setViewport] = useState<{ height: number; top: number }>();

  useLayoutEffect(() => {
    const visible = window.visualViewport;
    const update = () => setViewport({
      height: visible?.height ?? window.innerHeight,
      top: visible?.offsetTop ?? 0,
    });
    update();
    window.addEventListener('resize', update);
    visible?.addEventListener('resize', update);
    visible?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      visible?.removeEventListener('resize', update);
      visible?.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <View style={styles.frame}>
      <View style={[styles.viewport, viewport && {
        height: viewport.height,
        top: viewport.top,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
      }]}>
        {children}
        <ViewportCobwebs />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden', width: '100%', maxWidth: 560, alignSelf: 'center' },
});
