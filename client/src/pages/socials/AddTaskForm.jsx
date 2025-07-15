import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Textinput from "@/components/ui/Textinput";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import useToast from "../../hooks/useToast";
import Select from "react-select";
import Fileinput from "../../components/ui/Fileinput";
import { imageBaseUrl } from "../../constant/common";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { apiEndpoint as baseUrl } from "../../constant/common";

const schema = yup.object({
  reward: yup.string().required("Reward is required"),
  title: yup.string().required("Title is required"),
  link: yup.string().when("type", {
    is: "redirect",
    then: yup.string().required("Link is required for redirect"),
    otherwise: yup.string().nullable(),
  }),
  selecty76: yup.string().required("Type is required"),
});

const typeOptions = [
  { label: "redirect", value: "redirect" },
  { label: "redirect-hook", value: "redirect-hook" },
  { label: "share-tweet", value: "share-tweet" },
  { label: "share-telegram", value: "share-telegram" },
  { label: "followX", value: "followX" },
  { label: "daily-login", value: "daily-login" },
  { label: "daily-attempts", value: "daily-attempts" },
];

const styles = {
  option: (provided, state) => ({
    ...provided,
    fontSize: "14px",
    color: state.isSelected ? "#6D6D6D" : "#4B4B4B",
    backgroundColor: state.isSelected ? "#6D6D6D" : "#4B4B4B",
    "&:hover": {
      backgroundColor: "#6D6D6D",
    },
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999,
    backgroundColor: "#4B4B4B",
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#FFFFFF",
  }),
};

const EditTask = ({ taskDetails, socialId, onSubmit, dailyTasks }) => {
  const [show, setShow] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
    clearErrors,
  } = useForm({
    defaultValues: {
      reward: "",
      taskId: "1",
      title: "",
      link: "",
      type: "",
      content: "",
      userFollowTwitterId: "",
      mode: "onChange",
      resolver: yupResolver(schema),
    },
  });

  const { apiCall } = useApi();
  const cookies = new Cookies();
  const { toastSuccess, toastError } = useToast();
  const [selectedValue, setSelectedValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const twitterUrl = `${baseUrl}get-twitter-user?username=test`;

  useEffect(() => {
    if (show && taskDetails) {
      setValue("reward", taskDetails?.reward?.sake || "");
      setValue("title", taskDetails?.title || "");
      setValue("link", taskDetails.link || "");
      setValue("type", taskDetails.type || "");
      setValue("content", taskDetails.content || "");
      setValue("userFollowTwitterId", taskDetails.userFollowId || "");
      setSelectedValue(typeOptions.find((type) => type.value === taskDetails?.type) || null);
      setPreviewUrl(taskDetails?.icon ? `${imageBaseUrl}${taskDetails.icon}` : null);
    }
  }, [show, taskDetails, setValue]);

  const handleSetShow = () => {
    if (!show) {
      reset();
      clearErrors();
      setFile(null);
      setFileError(null);
      setPreviewUrl(null);
      setSelectedValue(null);
    }
    setShow(!show);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 1048576) {
        setFileError("File size should not exceed 1MB");
        setFile(null);
        setPreviewUrl(null);
      } else {
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setFileError(null);
        clearErrors("icon");
      }
    }
  };

  const handleFormSubmit = async (data) => {
    if (!data.reward || !data.title || !selectedValue?.value || !file || (selectedValue?.value === "share-tweet" && data.content === "") || (selectedValue?.value === "followX" && data.userFollowId === "")) {
      toastError("Please fill in all required fields.");
      return;
    }

    if (data?.reward <= 0) {
      toastError("Reward should be greater than 0.");
      return;
    }

    try {
      setLoading(true);
      const tasks = [
        {
          reward: { sake: data?.reward, health: 0, mana: 0 },
          title: data?.title,
          link: selectedValue?.value === "redirect" ? data?.link : "",
          type: selectedValue?.value,
          content: selectedValue?.value === "share-tweet" ? data?.content : "",
          userFollowId: selectedValue?.value === "followX" ? data?.userFollowId : "",
        },
      ];

      const formData = new FormData();
      formData.append("socialId", socialId);
      formData.append("tasks", JSON.stringify(tasks));
      {
        dailyTasks ? formData.append("key", "dailyTasks") : formData.append("key", "socialPlatforms");
      }
      if (file) {
        formData.append("imageUrl", file);
      }

      console.log("AddFormValues", data.reward, data?.title, data?.link, selectedValue.value, formData, Object.fromEntries(formData.entries()));
      const response = await apiCall("POST", "admin/socials", formData, cookies.get("auth-token"), "multipart/form-data");
      if (response.success) {
        onSubmit();
        setShow(false);
        toastSuccess("Task added successfully");
      } else {
        toastError("Failed to add task");
      }
    } catch (error) {
      toastError("An error occurred while adding the task");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShow(false);
    toastError("No added in social task");
    reset();
  };

  return (
    <>
      <div className="hover:cursor-pointer" onClick={handleSetShow}>
        <Button text="Add Task" className="btn-primary py-2" />
      </div>
      <Modal activeModal={show} onClose={() => setShow(false)} title="Add Task" className="max-w-3xl" centered>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="mb-3">
            <Textinput
              name="reward"
              label="Reward(Sake)"
              type="number"
              placeholder="Enter Reward"
              register={register}
              onWheel={(e) => e.currentTarget.blur()}
              onKeyDown={(e) => {
                if (["e", "E", "-", "+", "."].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              id="reward"
              error={errors.reward}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
            />
            <Textinput
              name="title"
              label="Title"
              type="text"
              placeholder="Enter Title"
              id="name"
              register={register}
              error={errors?.title}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
            />

            <div className="formGroup">
              <label className="form-label block">Type</label>
              <Select
                styles={styles}
                options={typeOptions}
                value={selectedValue}
                onChange={(val) => setSelectedValue(val)}
                placeholder="Select Type"
                className="react-select"
                classNamePrefix="select"
                id="selecty76"
              />
              {errors.selecty76 && <p className="text-red-500 mt-2">{errors.selecty76.message}</p>}
            </div>
            {selectedValue?.value === "redirect" && (
              <Textinput
                name="link"
                label="Link"
                type="text"
                placeholder="Enter Link"
                required
                id="link"
                register={register}
                error={errors.link}
                className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
              />
            )}
            {selectedValue?.value === "share-tweet" && (
              <Textinput
                name="content"
                label="Content"
                type="text"
                placeholder="Enter content"
                id="content"
                register={register}
                error={errors.content}
                className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
              />
            )}

            {selectedValue?.value === "followX" &&
              <div className="w-full bg-slate-900 text-slate-400 p-4 rounded-lg   mx-auto mt-4 mb-2">
                <p className="text-lg font-bold mb-2 text-slate-400">Steps to Retrieve the Followed Twitter ID</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>
                    <span className="font-bold">Copy the URL:</span> Use the following link:
                    <br />
                    <code className=" p-1 rounded text-blue-600 break-all">
                      {twitterUrl}
                    </code>
                  </li>
                  <li>
                    <span className=" font-bold">Modify the Username:</span> Replace <code className="text-slate-300">test</code> with the desired Twitter username.
                  </li>
                  <li>
                    <span className="font-bold">Open in Browser:</span> Paste the modified URL into your web browser's address bar and hit <span className=" text-slate-300">Enter</span>.
                  </li>
                  <li>
                    <span className="font-bold">Review the Response:</span> The response will contain the <code className="text-slate-300"> Twitter ID </code> in the <code className="text-slate-300">data</code> field.
                  </li>
                  <li>
                    <span className="font-bold">Enter the ID:</span> Please provide the <code className="text-slate-300">Twitter ID </code>  found in the <code className="text-slate-300">data</code> field here.
                  </li>
                </ol>
              </div>
            }



            {selectedValue?.value === "followX" && (
              <Textinput
                name="userFollowId"
                label="User Follow Twitter Id"
                type="text"
                placeholder="Enter Twitter Id"
                id="userFollowId"
                register={register}
                error={errors.userFollowId}
                className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
              />
            )}

            <div className="formGroup mt-4">
              <label className="form-label block">Image</label>
              <Fileinput selectedFile={file} onChange={handleFileChange} />
              {fileError && <p className="text-red-500 mt-2">{fileError}</p>}
              {(file || taskDetails?.icon) && (
                <img
                  src={file ? previewUrl : `${imageBaseUrl}${taskDetails?.icon}`}
                  alt="Selected Image"
                  className="mt-4 h-20 rounded-md"
                />
              )}
            </div>
          </div>
          <div className="flex justify-end pt-6 space-x-4">
            <Button text="Cancel" className="btn-secondary py-2" onClick={handleCancel} />
            {loading ? (
              <Button text="Saving..." className="btn-primary py-2" disabled />
            ) : (
              <Button text="Add Task" className="btn-primary py-2" type="submit" />
            )}
          </div>
        </form>
      </Modal>
    </>
  );
};

export default EditTask;
