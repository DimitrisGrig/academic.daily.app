import { LoadingOutlined } from "@ant-design/icons";

function Loading() {
  return (
    <>
      <div className="flex justify-center items-center">
        <div className="mt-24 text-center">
          <p className=" text-xl mb-4 font-medium text-sky-600">Loading...</p>
          <LoadingOutlined className="text-4xl! text-sky-600! animate-spin" />
        </div>
      </div>
    </>
  );
}

export default Loading;
