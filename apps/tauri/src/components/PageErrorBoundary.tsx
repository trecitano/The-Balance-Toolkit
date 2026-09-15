import { Component } from "react";
import type { PropsWithChildren } from "react";
import { QueryStatus } from "./QueryStatus";

export class PageErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <QueryStatus error={this.state.error} onRetry={() => this.setState({ error: null })} />
    ) : (
      this.props.children
    );
  }
}
