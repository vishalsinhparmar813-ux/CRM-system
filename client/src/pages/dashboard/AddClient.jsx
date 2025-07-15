import React, { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import Card from "../../components/ui/Card";
import Textinput from "../../components/ui/Textinput";
import Button from "../../components/ui/Button";
import Checkbox from "../../components/ui/Checkbox";
import useToast from "../../hooks/useToast";
import useDebouncedValue from "../../hooks/useDebouncedValue";

const AddClient = ({ onComplete }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const { toastSuccess, toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    alias: "",
    email: "",
    mobile: "",
    correspondenceAddress: {
      country: "",
      state: "",
      city: "",
      area: "",
      postalCode: "",
      landmark: "",
    },
    permanentAddress: {
      country: "",
      state: "",
      city: "",
      area: "",
      postalCode: "",
      landmark: "",
    },
  });
  const [sameAddress, setSameAddress] = useState(false);
  
  // Debounce email for validation
  const debouncedEmail = useDebouncedValue(formData.email, 500);
  
  // Use direct mobile value for validation (no debouncing needed since we only check at 10 digits)
  const mobileValue = formData.mobile;
  
  // Track if we should check for duplicates
  const [shouldCheckEmail, setShouldCheckEmail] = useState(false);
  const [shouldCheckMobile, setShouldCheckMobile] = useState(false);
  
  // Track last checked values to prevent duplicate API calls
  const [lastCheckedEmail, setLastCheckedEmail] = useState("");
  const [lastCheckedMobile, setLastCheckedMobile] = useState("");
  
  // Reset check flags when component mounts
  useEffect(() => {
    setShouldCheckEmail(false);
    setShouldCheckMobile(false);
    setLastCheckedEmail("");
    setLastCheckedMobile("");
  }, []);

  // Real-time validation
  useEffect(() => {
    const newErrors = {};
    
    // Name validation
    if (touched.name && !formData.name.trim()) {
      newErrors.name = "Client name is required";
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }
    
    // Mobile validation
    if (!formData.mobile) {
      newErrors.mobile = "Mobile number is required";
    } else {
      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(formData.mobile)) {
        newErrors.mobile = "Please enter a valid 10-digit mobile number";
      }
    }
    
    setErrors(newErrors);
  }, [formData, touched]);

  // Check for duplicate email
  useEffect(() => {
    const checkDuplicateEmail = async () => {
      if (shouldCheckEmail && debouncedEmail && debouncedEmail.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(debouncedEmail)) {
          // Prevent duplicate API calls for the same email
          if (lastCheckedEmail === debouncedEmail) {
            return;
          }
          
          try {
            setLastCheckedEmail(debouncedEmail);
            const token = cookies.get("auth-token");
            const response = await apiCall("GET", `client/search/${debouncedEmail}`, null, token);
            
            if (response && response.data && response.data.length > 0) {
              const existingClient = response.data.find(client => 
                client.email.toLowerCase() === debouncedEmail.toLowerCase()
              );
              
              if (existingClient) {
                setErrors(prev => ({
                  ...prev,
                  email: "A client with this email already exists"
                }));
              } else {
                // Clear email error if no duplicate found
                setErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors.email === "A client with this email already exists") {
                    delete newErrors.email;
                  }
                  return newErrors;
                });
              }
            } else {
              // Clear email error if no results found
              setErrors(prev => {
                const newErrors = { ...prev };
                if (newErrors.email === "A client with this email already exists") {
                  delete newErrors.email;
                }
                return newErrors;
              });
            }
          } catch (error) {
            console.error("Error checking email:", error);
          }
        }
      }
    };

    checkDuplicateEmail();
  }, [shouldCheckEmail, debouncedEmail, apiCall, cookies, lastCheckedEmail]);

  // Check for duplicate mobile - only when exactly 10 digits are entered
  useEffect(() => {
    const checkDuplicateMobile = async () => {
      // Only check if mobile is exactly 10 digits and we should check
      if (shouldCheckMobile && mobileValue && mobileValue.length === 10) {
        const mobileRegex = /^[0-9]{10}$/;
        if (mobileRegex.test(mobileValue)) {
          // Prevent duplicate API calls for the same mobile
          if (lastCheckedMobile === mobileValue) {
            return;
          }
          
          try {
            setLastCheckedMobile(mobileValue);
            const token = cookies.get("auth-token");
            const response = await apiCall("GET", `client/search/${mobileValue}`, null, token);
            
            if (response && response.data && response.data.length > 0) {
              const existingClient = response.data.find(client => 
                client.mobile === mobileValue
              );
              
              if (existingClient) {
                setErrors(prev => ({
                  ...prev,
                  mobile: "A client with this mobile number already exists"
                }));
              } else {
                // Clear mobile error if no duplicate found
                setErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors.mobile === "A client with this mobile number already exists") {
                    delete newErrors.mobile;
                  }
                  return newErrors;
                });
              }
            } else {
              // Clear mobile error if no results found
              setErrors(prev => {
                const newErrors = { ...prev };
                if (newErrors.mobile === "A client with this mobile number already exists") {
                  delete newErrors.mobile;
                }
                return newErrors;
              });
            }
          } catch (error) {
            console.error("Error checking mobile:", error);
          }
        }
      } else if (shouldCheckMobile && mobileValue && mobileValue.length !== 10) {
        // Clear mobile error if not exactly 10 digits
        setErrors(prev => {
          const newErrors = { ...prev };
          if (newErrors.mobile === "A client with this mobile number already exists") {
            delete newErrors.mobile;
          }
          return newErrors;
        });
      }
    };

    checkDuplicateMobile();
  }, [shouldCheckMobile, mobileValue, apiCall, cookies, lastCheckedMobile]);

  useEffect(() => {
    if (sameAddress) {
      setFormData(prev => ({
        ...prev,
        permanentAddress: { ...prev.correspondenceAddress }
      }));
    }
  }, [sameAddress, formData.correspondenceAddress]);

  const handleInputChange = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Only trigger duplicate checks for email and mobile fields
    if (field === "email") {
      setShouldCheckEmail(true);
      // Reset last checked email if the value has changed
      if (lastCheckedEmail !== value) {
        setLastCheckedEmail("");
      }
    } else if (field === "mobile") {
      setShouldCheckMobile(true);
      // Reset last checked mobile if the value has changed
      if (lastCheckedMobile !== value) {
        setLastCheckedMobile("");
      }
    }
  };

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Client name is required";
    }
    
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }
    
    if (!formData.mobile) {
      newErrors.mobile = "Mobile number is required";
    } else {
      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(formData.mobile)) {
        newErrors.mobile = "Please enter a valid 10-digit mobile number";
      }
    }
    
    // Check if there are any existing errors (like duplicate email)
    const existingErrors = { ...errors };
    Object.keys(existingErrors).forEach(key => {
      if (existingErrors[key] && key !== 'form') {
        newErrors[key] = existingErrors[key];
      }
    });
    
    // Mark all fields as touched
    setTouched({
      name: true,
      email: true,
      mobile: true,
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("POST", "client", formData, token);
      
      if (response?.success) {
        toastSuccess("Client added successfully!");
        setFormData({
          name: "",
          alias: "",
          email: "",
          mobile: "",
          correspondenceAddress: {
            country: "",
            state: "",
            city: "",
            area: "",
            postalCode: "",
            landmark: "",
          },
          permanentAddress: {
            country: "",
            state: "",
            city: "",
            area: "",
            postalCode: "",
            landmark: "",
          },
        });
        setTouched({});
        setErrors({});
        setShouldCheckEmail(false);
        setShouldCheckMobile(false);
        setLastCheckedEmail("");
        setLastCheckedMobile("");
        if (onComplete) onComplete();
      } else {
        // Handle specific error messages from backend
        const errorMessage = response.message || response.error || "Failed to add client";
        
        // If it's a duplicate error, show it more prominently
        if (errorMessage.includes("email already exists")) {
          setErrors(prev => ({
            ...prev,
            email: errorMessage,
            form: errorMessage
          }));
        } else if (errorMessage.includes("mobile number already exists")) {
          setErrors(prev => ({
            ...prev,
            mobile: errorMessage,
            form: errorMessage
          }));
        } else {
          setErrors(prev => ({
            ...prev,
            form: errorMessage
          }));
        }
      }
    } catch (error) {
      console.error("Error adding client:", error);
      setErrors(prev => ({
        ...prev,
        form: error.message || "Failed to add client"
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Add New Client</h2>
        <Button
          onClick={onComplete}
          className="btn btn-outline-secondary"
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Show backend error at the top of the form */}
        {errors.form && (
          <div className="text-red-500 mb-2">{errors.form}</div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textinput
            label="Client Name *"
            type="text"
            placeholder="Enter client name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            onBlur={() => handleFieldBlur("name")}
            error={touched.name && errors.name}
            required
          />
          <Textinput
            label="Alias"
            type="text"
            placeholder="Enter alias"
            value={formData.alias}
            onChange={(e) => handleInputChange("alias", e.target.value)}
            onBlur={() => handleFieldBlur("alias")}
            error={touched.alias && errors.alias}
          />
          <Textinput
            label="Email *"
            type="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            onBlur={() => handleFieldBlur("email")}
            error={touched.email && errors.email}
            required
          />
          <Textinput
            label="Mobile Number *"
            type="tel"
            placeholder="Enter mobile number"
            value={formData.mobile}
            onChange={(e) => handleInputChange("mobile", e.target.value)}
            onBlur={() => handleFieldBlur("mobile")}
            error={touched.mobile && errors.mobile}
            required
          />
        </div>

        {/* Correspondence Address */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Correspondence Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textinput
              label="Country"
              type="text"
              placeholder="Enter country"
              value={formData.correspondenceAddress.country}
              onChange={(e) => handleInputChange("correspondenceAddress.country", e.target.value)}
            />
            <Textinput
              label="State"
              type="text"
              placeholder="Enter state"
              value={formData.correspondenceAddress.state}
              onChange={(e) => handleInputChange("correspondenceAddress.state", e.target.value)}
            />
            <Textinput
              label="City"
              type="text"
              placeholder="Enter city"
              value={formData.correspondenceAddress.city}
              onChange={(e) => handleInputChange("correspondenceAddress.city", e.target.value)}
            />
            <Textinput
              label="Area"
              type="text"
              placeholder="Enter area"
              value={formData.correspondenceAddress.area}
              onChange={(e) => handleInputChange("correspondenceAddress.area", e.target.value)}
            />
            <Textinput
              label="Postal Code"
              type="text"
              placeholder="Enter postal code"
              value={formData.correspondenceAddress.postalCode}
              onChange={(e) => handleInputChange("correspondenceAddress.postalCode", e.target.value)}
            />
            <Textinput
              label="Landmark"
              type="text"
              placeholder="Enter landmark"
              value={formData.correspondenceAddress.landmark}
              onChange={(e) => handleInputChange("correspondenceAddress.landmark", e.target.value)}
            />
          </div>
        </div>

        {/* Permanent Address */}
        <div className="border-t pt-6">
          <div className="mb-2">
            <Checkbox
              label="Is Permanent Address Same as Correspondence Address?"
              checked={sameAddress}
              onChange={() => setSameAddress(val => !val)}
            />
          </div>
          <h3 className="text-lg font-medium mb-4">Permanent Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textinput
              label="Country"
              type="text"
              placeholder="Enter country"
              value={formData.permanentAddress.country}
              onChange={(e) => handleInputChange("permanentAddress.country", e.target.value)}
              disabled={sameAddress}
            />
            <Textinput
              label="State"
              type="text"
              placeholder="Enter state"
              value={formData.permanentAddress.state}
              onChange={(e) => handleInputChange("permanentAddress.state", e.target.value)}
              disabled={sameAddress}
            />
            <Textinput
              label="City"
              type="text"
              placeholder="Enter city"
              value={formData.permanentAddress.city}
              onChange={(e) => handleInputChange("permanentAddress.city", e.target.value)}
              disabled={sameAddress}
            />
            <Textinput
              label="Area"
              type="text"
              placeholder="Enter area"
              value={formData.permanentAddress.area}
              onChange={(e) => handleInputChange("permanentAddress.area", e.target.value)}
              disabled={sameAddress}
            />
            <Textinput
              label="Postal Code"
              type="text"
              placeholder="Enter postal code"
              value={formData.permanentAddress.postalCode}
              onChange={(e) => handleInputChange("permanentAddress.postalCode", e.target.value)}
              disabled={sameAddress}
            />
            <Textinput
              label="Landmark"
              type="text"
              placeholder="Enter landmark"
              value={formData.permanentAddress.landmark}
              onChange={(e) => handleInputChange("permanentAddress.landmark", e.target.value)}
              disabled={sameAddress}
            />
          </div>
        </div>

        {formData.bname !== undefined && (
          <Textinput
            label="Business Name *"
            type="text"
            placeholder="Enter business name"
            value={formData.bname}
            onChange={(e) => handleInputChange("bname", e.target.value)}
            onBlur={() => handleFieldBlur("bname")}
            error={touched.bname && errors.bname}
            required
          />
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" onClick={onComplete} className="btn btn-outline-secondary">
            Cancel
          </Button>
          <Button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Adding..." : "Add Client"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default AddClient;
