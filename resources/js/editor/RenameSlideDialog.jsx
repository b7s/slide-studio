import RenameDialog from "./RenameDialog";
import {__} from "../lib/i18n";

export default function RenameSlideDialog({ open, initialTitle = "", onClose, onRename }) {
    return (
        <RenameDialog
            open={open}
            title={__("messages.sidebar.rename_title")}
            description={__("messages.sidebar.rename_desc")}
            label={__("messages.sidebar.rename_label")}
            initialValue={initialTitle}
            confirmLabel={__("messages.sidebar.rename_confirm")}
            onClose={onClose}
            onRename={onRename}
        />
    );
}
