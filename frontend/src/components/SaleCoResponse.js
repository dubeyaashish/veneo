import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://ppg24.tech/api';

const SaleCoResponse = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const action = searchParams.get('action') || 'approve';
  const deptParam = searchParams.get('dept');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const department = deptParam || currentUser?.department || '';

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/order/${id}/respond`, {
        department,
        action,
        remark,
        respondedBy: currentUser?.telegram_id
      });
      toast.success('ส่งข้อมูลเรียบร้อย');
      navigate('/');
    } catch (err) {
      console.error('Error submitting response:', err);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  if (action === 'approve') {
    return (
      <div className="text-center mt-5">
        <h3>ยืนยันการอนุมัติ Sales Order #{id}</h3>
        <button className="btn btn-success mt-3" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'กำลังส่ง...' : 'ผ่าน'}
        </button>
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '600px' }}>
      <h3 className="mb-3">ส่งแก้ไข Sales Order #{id}</h3>
      <div className="mb-3">
        <label className="form-label">หมายเหตุ</label>
        <textarea className="form-control" rows="4" value={remark} onChange={e => setRemark(e.target.value)} />
      </div>
      <button className="btn btn-danger" disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'กำลังส่ง...' : 'ส่งไปแก้ไข'}
      </button>
    </div>
  );
};

export default SaleCoResponse;
