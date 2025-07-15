import React, { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import Textinput from "@/components/ui/Textinput";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
import Cookies from "universal-cookie";
import Loading from "@/components/Loading";

const ProductGroups = () => {
  const { apiCall } = useApi();
  const { toastSuccess, toastError } = useToast();
  const cookies = new Cookies();
  const [loading, setLoading] = useState(true);
  const [productGroups, setProductGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  useEffect(() => {
    fetchProductGroups();
  }, []);

  const fetchProductGroups = async () => {
    setLoading(true);
    try {
      const token = cookies.get("auth-token");
      const response = await apiCall("GET", "productGroup/all", null, token);
      setProductGroups(response || []);
    } catch (error) {
      console.error("Error fetching product groups:", error);
      toastError("Failed to fetch product groups");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toastError("Product group name is required");
      return;
    }

    try {
      const token = cookies.get("auth-token");
      
      if (editingGroup) {
        // Update existing group
        const response = await apiCall(
          "PATCH",
          `productGroup/${editingGroup._id}`,
          formData,
          token
        );
        
        if (response?.productGroup) {
          toastSuccess("Product group updated successfully");
          setProductGroups(prev => 
            prev.map(group => 
              group._id === editingGroup._id ? response.productGroup : group
            )
          );
        }
      } else {
        // Create new group
        const response = await apiCall(
          "POST",
          "productGroup",
          formData,
          token
        );
        
        if (response?.productGroup) {
          toastSuccess("Product group created successfully");
          setProductGroups(prev => [...prev, response.productGroup]);
        }
      }
      
      handleCloseModal();
    } catch (error) {
      console.error("Error saving product group:", error);
      toastError("Failed to save product group");
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      isActive: group.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm("Are you sure you want to delete this product group?")) {
      return;
    }

    try {
      const token = cookies.get("auth-token");
      await apiCall("DELETE", `productGroup/${groupId}`, null, token);
      
      toastSuccess("Product group deleted successfully");
      setProductGroups(prev => prev.filter(group => group._id !== groupId));
    } catch (error) {
      console.error("Error deleting product group:", error);
      toastError("Failed to delete product group");
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    setFormData({
      name: "",
      description: "",
      isActive: true,
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Groups</h1>
          <p className="text-gray-600 mt-1">Manage product categories and groups</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Icon icon="heroicons:plus" className="w-4 h-4 mr-2" />
          Add Product Group
        </Button>
      </div>

      {/* Product Groups Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Product Groups</h2>
          <div className="text-sm text-gray-500">
            {productGroups.length} group{productGroups.length !== 1 ? 's' : ''}
          </div>
        </div>

        {productGroups.length === 0 ? (
          <div className="text-center py-12">
            <Icon icon="heroicons:folder" className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Groups</h3>
            <p className="text-gray-600">Create your first product group to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productGroups.map((group, index) => (
                  <tr key={group._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {group.description || "No description"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={group.isActive}
                        onChange={async (e) => {
                          const newStatus = e.target.checked;
                          try {
                            const token = cookies.get("auth-token");
                            const response = await apiCall(
                              "PATCH",
                              `productGroup/${group._id}`,
                              { isActive: newStatus },
                              token
                            );
                            if (response?.productGroup) {
                              setProductGroups(prev =>
                                prev.map(g =>
                                  g._id === group._id ? { ...g, isActive: newStatus } : g
                                )
                              );
                              toastSuccess(`Product group marked as ${newStatus ? "Active" : "Inactive"}`);
                            } else {
                              throw new Error("Failed to update status");
                            }
                          } catch (error) {
                            toastError("Failed to update status");
                          }
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        group.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {group.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {group.createdAt && !isNaN(new Date(group.createdAt))
                        ? new Date(group.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(group)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Icon icon="heroicons:pencil-square" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(group._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Icon icon="heroicons:trash" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        activeModal={showModal}
        onClose={handleCloseModal}
        title={editingGroup ? "Edit Product Group" : "Add Product Group"}
        className="max-w-md"
        centered
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textinput
            label="Group Name *"
            type="text"
            placeholder="Enter group name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            required
          />

          <Textinput
            label="Description"
            type="text"
            placeholder="Enter description (optional)"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
          />

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange("isActive", e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" onClick={handleCloseModal} className="btn btn-outline-secondary">
              Cancel
            </Button>
            <Button type="submit" className="btn btn-primary">
              {editingGroup ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductGroups; 