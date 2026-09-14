import React from 'react';
import { X, CheckCircle, ExternalLink, HelpCircle, Sparkles } from 'lucide-react';
import { CARRIERS } from '../services/carrierDetector';

interface CarrierGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CarrierGuideModal: React.FC<CarrierGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const rules = [
    {
      carrier: CARRIERS.ghn,
      rule: 'Ký tự bắt đầu bằng "GY" hoặc "G8", "GHN" (Ví dụ thực tế: GY8X37DK)',
      description: 'Hệ thống tự động liên kết đến Cổng vận đơn GHN: https://donhang.ghn.vn/?order_code=GY8X37DK'
    },
    {
      carrier: CARRIERS.spx,
      rule: 'Ký tự bắt đầu bằng "SPXVN" hoặc "SPX", "VNSPX" (Ví dụ: SPXVN062371495019)',
      description: 'Hệ thống tự động liên kết đến Cổng SPX Express Việt Nam: https://spx.vn/vi và mở trực tiếp trang tra cứu: https://spx.vn/track?SPXVN062371495019'
    },
    {
      carrier: CARRIERS.jt,
      rule: 'Mã 12 chữ số đầu 8: 8623..., 84..., 83..., JT... (Ví dụ: 862314159554)',
      description: 'Hệ thống tự động tra cứu Live API và mở khóa cổng J&T Express (kèm hỗ trợ 4 số cuối SĐT).'
    },
    {
      carrier: CARRIERS.jt_cargo,
      rule: 'Mã 12 chữ số đầu 53: 530..., 53... (Ví dụ: 530409240209)',
      description: 'Hệ thống tự động tra cứu qua Cổng J&T Cargo chuyên tuyến hàng nặng kiện lớn: https://office.jtcargo.com.vn/'
    },
    {
      carrier: CARRIERS.viettelpost,
      rule: 'Bắt đầu bằng VT, VTP hoặc dãy số 9-12 chữ số (Ví dụ: VT892301928)',
      description: 'Mã bưu gửi bưu chính Viettel Post toàn quốc.'
    },
    {
      carrier: CARRIERS.ninjavan,
      rule: 'Bắt đầu bằng NIVN, SHP hoặc NLVN (Ví dụ: NIVN82910293)',
      description: 'Mã vận đơn Ninja Van Việt Nam.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Quy Tắc Nhận Diện Mã Vận Đơn Tự Động
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tự động phân loại chính xác khi bạn dán 5.000+ mã từ Excel/Sheets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="space-y-2.5">
            {rules.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border font-mono ${item.carrier.badgeBg}`}>
                      {item.carrier.name}
                    </span>
                  </div>
                  <a
                    href={item.carrier.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-700 hover:text-slate-950 font-semibold hover:underline flex items-center font-mono"
                  >
                    Web tra cứu <ExternalLink className="w-2.5 h-2.5 ml-1" />
                  </a>
                </div>

                <div className="text-xs font-bold text-slate-800 pt-1 font-mono">
                  {item.rule}
                </div>

                <div className="text-[11px] text-slate-600 font-medium">
                  {item.description}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 space-y-1">
            <div className="font-bold flex items-center font-mono text-[11px] uppercase tracking-wider">
              <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
              Mẹo xử lý 5.000 đơn / ngày:
            </div>
            <p className="text-slate-700 text-[11px] leading-relaxed">
              Bạn có thể copy thẳng toàn bộ cột A từ Excel (kể cả có lẫn lộn mã GHN, SPX và J&T Express) rồi dán vào ô nhập liệu. Hệ thống sẽ tự động bóc tách từng mã và phân luồng kiểm tra song song siêu tốc!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Đã hiểu, quay lại quét đơn
          </button>
        </div>

      </div>
    </div>
  );
};
