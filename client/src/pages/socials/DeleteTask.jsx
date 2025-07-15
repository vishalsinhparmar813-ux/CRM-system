import React from "react";
import Swal from "sweetalert2";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const DeleteTask = ({ socialId, taskId, onDeleteSuccess, dailyTasks }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const key = dailyTasks ? "dailyTasks" : "socialPlatforms";

  const handleDelete = async () => {
    Swal.fire({
      title: "Do you really want to delete this Task?",
      showDenyButton: true,
      confirmButtonText: "Yes",
      denyButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const deleteResult = await apiCall(
            "DELETE",
            "admin/socials",
            { socialId, taskId, key },
            cookies.get("auth-token")
          );
          if (deleteResult.success) {
            onDeleteSuccess();
            Swal.fire("Task deleted successfully", "", "success");
          } else {
            Swal.fire("Error deleting task", "", "error");
          }
        } catch (error) {
          Swal.fire("Error deleting task", "", "error");
        }
      }
    });
  };

  return (
    <div className="hover:cursor-pointer" onClick={handleDelete}>
      <Icon icon={"fluent:delete-20-regular"} width={20} />
    </div>
  );
};

export default DeleteTask;
