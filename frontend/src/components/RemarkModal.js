import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const RemarkModal = ({ show, onHide, onSave, initialValue, conditions }) => {
  const [checkboxes, setCheckboxes] = useState({});
  const [additionalRemark, setAdditionalRemark] = useState('');

  // Parse initial value when opening modal
  useEffect(() => {
    if (show) {
      if (initialValue && initialValue.length > 0) {
        const allParts = initialValue.split(',').map(str => str.trim()).filter(Boolean);
        // Flatten all condition names for easy matching
        const conditionsFlat = [];
        Object.entries(conditions).forEach(([group, items]) => {
          items.forEach(item => conditionsFlat.push({ ...item, group }));
        });

        const newCheckboxes = {};
        let remarkParts = [];
        allParts.forEach(part => {
          const found = conditionsFlat.find(cond => part === cond.condition_name);
          if (found) {
            newCheckboxes[found.id] = true;
          } else {
            remarkParts.push(part);
          }
        });

        setCheckboxes(newCheckboxes);
        setAdditionalRemark(remarkParts.join(', '));
      } else {
        setCheckboxes({});
        setAdditionalRemark('');
      }
    }
  }, [show, initialValue, conditions]);

  const handleCheckboxChange = (id, checked) => {
    setCheckboxes(prev => ({
      ...prev,
      [id]: checked
    }));
  };

  const handleSave = () => {
    // Gather checked conditions
    const selectedConditions = [];
    Object.entries(conditions).forEach(([groupName, items]) => {
      items.forEach(item => {
        if (checkboxes[item.id]) {
          selectedConditions.push(item.condition_name);
        }
      });
    });

    let result = selectedConditions.join(', ');
    if (additionalRemark && additionalRemark.trim()) {
      result = result ? result + ', ' + additionalRemark.trim() : additionalRemark.trim();
    }
    onSave(result);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>เลือกเงื่อนไขและหมายเหตุ</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <h6 className="mb-3">เงื่อนไขการเปิดบิล</h6>
          {Object.entries(conditions).map(([groupName, items]) => (
            <div className="card mb-3 shadow-sm border-0" key={groupName}>
              <div className="card-header bg-primary text-white py-2">{groupName}</div>
              <div className="card-body">
                {items
                  .filter(item => !!item.condition_name && item.condition_name !== '0')
                  .map(item => (
                    <div key={item.id} className="mb-2">
                      <Form.Check
                        type="checkbox"
                        id={`cond-${item.id}`}
                        label={item.condition_name}
                        checked={!!checkboxes[item.id]}
                        onChange={e => handleCheckboxChange(item.id, e.target.checked)}
                        className="mb-1"
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <div className="mt-4">
            <h6>หมายเหตุเพิ่มเติม (จะต่อท้ายด้วย comma)</h6>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="ระบุหมายเหตุเพิ่มเติม"
              value={additionalRemark}
              onChange={e => setAdditionalRemark(e.target.value)}
            />
            <Form.Text muted>
              หมายเหตุนี้จะถูกต่อท้ายรายการด้วย comma
            </Form.Text>
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          ยกเลิก
        </Button>
        <Button variant="primary" onClick={handleSave}>
          บันทึก
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RemarkModal;
