interface DeleteConfirmModalProps {
  show: boolean;
  itemLabel: string;
  /** Extra context shown under the main line (e.g. warnings about linked data). */
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  show,
  itemLabel,
  description,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!show) return null;

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteModalLabel"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="deleteModalLabel">
              Confirm Delete
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <p className="mb-2">
              Are you sure you want to delete <strong>{itemLabel}</strong>? This action cannot be
              undone.
            </p>
            {description ? <p className="text-secondary small mb-0">{description}</p> : null}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
