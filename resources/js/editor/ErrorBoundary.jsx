import { Component } from "react";
import { __ } from "../lib/i18n";

// Isolates a subtree (e.g. the Inspector) so a render/effect error there cannot
// unmount the whole editor — which would also kill the auto-save loop and lose
// the user's unsaved edits. The rest of the editor (canvas, autosave) keeps
// running; the failed panel shows a recoverable notice instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Editor panel error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-[var(--muted-foreground)]">
          {__(this.props.messageKey ?? "messages.editor.panel_error")}
          <button
            type="button"
            className="mt-2 block text-[var(--navy)] underline"
            onClick={() => this.setState({ error: null })}
          >
            {__(this.props.retryKey ?? "messages.editor.retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
