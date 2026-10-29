import { Component, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { isStaleBuildError, reloadForNewBuild } from '@/lib/stale-build';
import { reportError } from '@/lib/telemetry';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defence for render errors: reports once, shows a way back. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    if (isStaleBuildError(error)) {
      if (reloadForNewBuild()) return;
      reportError('stale-build', error);
      return;
    }
    reportError('render', error, { componentStack: info.componentStack?.slice(0, 1500) ?? null });
  }

  reset = (): void => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
    else this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (isStaleBuildError(this.state.error)) return <Crashed stale message="A newer version of the app was published while this one was open." onReset={this.reset} />;
    return <Crashed message={this.state.error.message} onReset={this.reset} />;
  }
}

function Crashed({ message, onReset, stale }: { message: string; onReset: () => void; stale?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl, gap: space.lg }} testID="crash-screen">
      <Text variant="title">{stale ? 'Update ready' : 'Something went wrong'}</Text>
      <Text color="textMuted">{stale ? 'Reload to pick up the new version. Nothing you logged is affected.' : 'This screen hit an error it could not recover from. The details were recorded so it can be fixed. Your logs are safe.'}</Text>
      <Text variant="caption" color="textFaint">
        {message}
      </Text>
      <Button label="Reload" onPress={onReset} />
    </View>
  );
}
