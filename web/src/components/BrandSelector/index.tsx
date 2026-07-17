// Brand Selector — dropdown to switch between brands
import { useFormStore } from '../../store/useFormStore';

export default function BrandSelector() {
  const brands = useFormStore(s => s.brands);
  const selectedBrand = useFormStore(s => s.selectedBrand);
  const brandsLoaded = useFormStore(s => s.brandsLoaded);
  const setSelectedBrand = useFormStore(s => s.setSelectedBrand);
  const loadBrands = useFormStore(s => s.loadBrands);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await setSelectedBrand(e.target.value);
  };

  if (!brandsLoaded) {
    return (
      <div className="form-group">
        <label>🏢 Brand</label>
        <select disabled>
          <option>Loading...</option>
        </select>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label>🏢 Brand</label>
      <select value={selectedBrand} onChange={handleChange}>
        {brands.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      {selectedBrand && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          Active: {selectedBrand}
        </div>
      )}
    </div>
  );
}
