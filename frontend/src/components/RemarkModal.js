// src/components/RemarkModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const RemarkModal = ({ show, onHide, onSave, initialValue, conditions }) => {
  const [checkboxes, setCheckboxes] = useState({});
  const [additionalInputs, setAdditionalInputs] = useState({});
  const [additionalRemark, setAdditionalRemark] = useState('');

  useEffect(() => {
    if (show && initialValue) {
      // Parse initial value
      const lines = initialValue.split('\n');
      const conditionText = lines[0] || '';
      const remarkText = lines.slice(1).join('\n');
      
      // Reset all states
      setCheckboxes({});
      setAdditionalInputs({});
      
      // Parse conditions
      if (conditionText) {
        const conditionsList = conditionText.split(', ');
        
        const newCheckboxes = {};
        const newInputs = {};
        
        conditionsList.forEach(condition => {
          let conditionName = condition;
          let additionalText = '';
          
          // Check if condition has additional input
          if (condition.includes('(') && condition.includes(')')) {
            const match = condition.match(/^(.*?)\s*\((.*?)\)$/);
            if (match) {
              conditionName = match[1].trim();
              additionalText = match[2].trim();
            }
          }
          
          // Find the condition in our list
          let conditionId = null;
          Object.entries(conditions).forEach(([groupName, items]) => {
            items.forEach(item => {
              if (item.condition_name === conditionName) {
                conditionId = item.id;
              }
            });
          });
          
          if (conditionId) {
            newCheckboxes[conditionId] = true;
            if (additionalText) {
              newInputs[conditionId] = additionalText;
            }
          }
        });
        
        setCheckboxes(newCheckboxes);
        setAdditionalInputs(newInputs);
      }
      
      setAdditionalRemark(remarkText);
    }
  }, [show, initialValue, conditions]);

  const handleCheckboxChange = (id, checked, requiresInput) => {
    setCheckboxes({
      ...checkboxes,
      [id]: checked
    });
    
    if (!checked && additionalInputs[id]) {
      const newInputs = { ...additionalInputs };
      delete newInputs[id];
      setAdditionalInputs(newInputs);
    }
  };

  const handleInputChange = (id, value) => {
    setAdditionalInputs({
      ...additionalInputs,
      [id]: value
    });
  };

  const handleSave = () => {
    // Gather selected conditions
    const selectedConditions = [];
    
    Object.entries(conditions).forEach(([groupName, items]) => {
      items.forEach(item => {
        if (checkboxes[item.id]) {
          const conditionName = item.condition_name;
          const additionalText = additionalInputs[item.id];
          
          if (additionalText) {
            selectedConditions.push(`${conditionName} (${additionalText})`);
          } else {
            selectedConditions.push(conditionName);
          }
        }
      });
    });
    
    const conditionText = selectedConditions.join(', ');
    const remarkText = additionalRemark.trim();
    const finalText = remarkText ? `${conditionText}\n${remarkText}` : conditionText;
    
    onSave(finalText);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>เพิ่มเงื่อนไขและหมายเหตุ</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <h6>เงื่อนไขการเปิดบิล</h6>
          
          {Object.entries(conditions).map(([groupName, items]) => (
            <div className="card mb-3 shadow-sm" key={groupName}>
              <div className="card-header bg-primary text-white">{groupName}</div>
              <div className="card-body">
                {items.map(item => (
                  <div key={item.id}>
                    <Form.Check
                      type="checkbox"
                      id={`cond-${item.id}`}
                      label={item.condition_name}
                      checked={checkboxes[item.id] || false}
                      onChange={(e) => handleCheckboxChange(item.id, e.target.checked, item.is_require_input)}
                      className="mb-2"
                    />
                    
                    {item.is_require_input && checkboxes[item.id] && (
                      <Form.Group className="mb-3">
                        <Form.Control
                          type="text"
                          placeholder="ระบุข้อมูลเพิ่มเติม"
                          value={additionalInputs[item.id] || ''}
                          onChange={(e) => handleInputChange(item.id, e.target.value)}
                          size="sm"
                        />
                      </Form.Group>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="mt-4">
            <h6>หมายเหตุเพิ่มเติม</h6>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="ระบุหมายเหตุเพิ่มเติม"
              value={additionalRemark}
              onChange={(e) => setAdditionalRemark(e.target.value)}
            />
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