// src/components/LogsModal.js
import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const LogsModal = ({ show, onHide, logs }) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>บันทึกการอัปเดต</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="update-log">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-muted">ไม่มีข้อมูลการอัปเดต</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onHide}>
          ปิด
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LogsModal;